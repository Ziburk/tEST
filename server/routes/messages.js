const express = require('express');
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get messages for a channel
router.get('/channel/:channelId', (req, res) => {
  const { channelId } = req.params;
  const userId = req.user.id;
  
  // Get the channel to check if it exists and get the server ID
  db.get('SELECT * FROM channels WHERE id = ?', [channelId], (err, channel) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user is a member of the server that owns this channel
    db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', [channel.server_id, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!member) {
        return res.status(403).json({ message: 'You do not have access to this channel' });
      }
      
      // Get messages for this channel with user information
      db.all(`
        SELECT m.*, u.username, u.avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = ?
        ORDER BY m.created_at DESC
        LIMIT 50
      `, [channelId], (err, messages) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        res.json({ messages: messages.reverse() }); // Reverse to get oldest messages first
      });
    });
  });
});

// Send a message to a channel
router.post('/channel/:channelId', (req, res) => {
  const { channelId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  
  if (!content) {
    return res.status(400).json({ message: 'Message content is required' });
  }
  
  // Get the channel to check if it exists and if it's a text channel
  db.get('SELECT * FROM channels WHERE id = ?', [channelId], (err, channel) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    if (channel.type !== 'text') {
      return res.status(400).json({ message: 'Can only send messages to text channels' });
    }
    
    // Check if user is a member of the server that owns this channel
    db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', [channel.server_id, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!member) {
        return res.status(403).json({ message: 'You do not have access to this channel' });
      }
      
      const messageId = uuidv4();
      
      // Insert the message
      db.run(
        'INSERT INTO messages (id, channel_id, sender_id, content) VALUES (?, ?, ?, ?)',
        [messageId, channelId, userId, content],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error sending message', error: err.message });
          }
          
          // Get the user information to include in the response
          db.get('SELECT username, avatar FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
              return res.status(500).json({ message: 'Database error', error: err.message });
            }
            
            const timestamp = new Date().toISOString();
            
            res.status(201).json({
              message: 'Message sent successfully',
              messageData: {
                id: messageId,
                channel_id: channelId,
                sender_id: userId,
                content,
                username: user.username,
                avatar: user.avatar,
                created_at: timestamp
              }
            });
          });
        }
      );
    });
  });
});

// Delete a message
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Get the message
  db.get('SELECT * FROM messages WHERE id = ?', [id], (err, message) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user is the message sender or has admin rights in the server
    if (message.sender_id !== userId) {
      // Get the channel to find the server
      db.get('SELECT * FROM channels WHERE id = ?', [message.channel_id], (err, channel) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        if (!channel) {
          return res.status(404).json({ message: 'Channel not found' });
        }
        
        // Check if user has admin rights
        db.get(`
          SELECT * FROM server_members 
          WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')
        `, [channel.server_id, userId], (err, member) => {
          if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
          }
          
          if (!member) {
            return res.status(403).json({ message: 'You do not have permission to delete this message' });
          }
          
          // Delete the message
          deleteMessage(id, res);
        });
      });
    } else {
      // User is the message sender, allow deletion
      deleteMessage(id, res);
    }
  });
});

// Helper function to delete a message
function deleteMessage(id, res) {
  db.run('DELETE FROM messages WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Error deleting message', error: err.message });
    }
    
    res.json({ message: 'Message deleted successfully' });
  });
}

// Get direct messages between two users
router.get('/direct/:userId', (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;
  
  // Get direct messages between these two users
  db.all(`
    SELECT dm.*, u.username, u.avatar
    FROM direct_messages dm
    JOIN users u ON dm.sender_id = u.id
    WHERE (dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?)
    ORDER BY dm.created_at DESC
    LIMIT 50
  `, [currentUserId, userId, userId, currentUserId], (err, messages) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    // Mark unread messages as read
    db.run(
      'UPDATE direct_messages SET read = 1 WHERE sender_id = ? AND receiver_id = ? AND read = 0',
      [userId, currentUserId]
    );
    
    res.json({ messages: messages.reverse() }); // Reverse to get oldest messages first
  });
});

// Send a direct message to a user
router.post('/direct/:userId', (req, res) => {
  const { userId } = req.params;
  const { content } = req.body;
  const senderId = req.user.id;
  
  if (!content) {
    return res.status(400).json({ message: 'Message content is required' });
  }
  
  // Check if recipient user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const messageId = uuidv4();
    
    // Insert the direct message
    db.run(
      'INSERT INTO direct_messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
      [messageId, senderId, userId, content],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error sending message', error: err.message });
        }
        
        // Get the sender information to include in the response
        db.get('SELECT username, avatar FROM users WHERE id = ?', [senderId], (err, sender) => {
          if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
          }
          
          const timestamp = new Date().toISOString();
          
          res.status(201).json({
            message: 'Direct message sent successfully',
            messageData: {
              id: messageId,
              sender_id: senderId,
              receiver_id: userId,
              content,
              read: 0,
              username: sender.username,
              avatar: sender.avatar,
              created_at: timestamp
            }
          });
        });
      }
    );
  });
});

// Delete a direct message
router.delete('/direct/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Get the direct message
  db.get('SELECT * FROM direct_messages WHERE id = ?', [id], (err, message) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user is the message sender
    if (message.sender_id !== userId) {
      return res.status(403).json({ message: 'You can only delete messages you sent' });
    }
    
    // Delete the direct message
    db.run('DELETE FROM direct_messages WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error deleting message', error: err.message });
      }
      
      res.json({ message: 'Message deleted successfully' });
    });
  });
});

module.exports = router;
