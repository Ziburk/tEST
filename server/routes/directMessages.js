const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

// Get all contacts for a user (people they've exchanged messages with)
router.get('/', (req, res) => {
  const userId = req.user.id;
  console.log('Getting contacts for user:', userId);
  
  // First, make sure the direct_messages table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      content TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (createTableErr) => {
    if (createTableErr) {
      console.error('Error creating direct_messages table:', createTableErr);
      return res.status(500).json({ message: 'Database error', error: createTableErr.message });
    }

    // Сначала получим всех пользователей, кроме текущего
    const allUsersQuery = `
      SELECT id, username, avatar, status, 0 as unread_count
      FROM users 
      WHERE id != ? 
      ORDER BY username
    `;
    
    db.all(allUsersQuery, [userId], (err, allUsers) => {
      if (err) {
        console.error('Error fetching all users:', err);
        return res.status(500).json({ message: 'Error fetching contacts', error: err.message });
      }
      
      console.log(`Found ${allUsers.length} users for potential contacts`);
      return res.status(200).json({ contacts: allUsers });
    });
  });
});

// Get messages between current user and another user
router.get('/:userId', (req, res) => {
  const currentUserId = req.user.id;
  const otherUserId = req.params.userId;
  
  // Query to get messages between two users
  const query = `
    SELECT * FROM direct_messages 
    WHERE (sender_id = ? AND receiver_id = ?) 
    OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `;
  
  db.all(query, [currentUserId, otherUserId, otherUserId, currentUserId], (err, messages) => {
    if (err) {
      console.error('Error fetching direct messages:', err);
      return res.status(500).json({ message: 'Error fetching messages' });
    }
    
    // Mark all unread messages as read
    db.run(
      `UPDATE direct_messages SET read = 1 
      WHERE receiver_id = ? AND sender_id = ? AND read = 0`,
      [currentUserId, otherUserId],
      (err) => {
        if (err) {
          console.error('Error marking messages as read:', err);
        }
      }
    );
    
    return res.status(200).json({ messages });
  });
});

// Send a message to another user
router.post('/:userId', (req, res) => {
  const senderId = req.user.id;
  const receiverId = req.params.userId;
  const { content } = req.body;
  
  if (!content || content.trim() === '') {
    return res.status(400).json({ message: 'Message content cannot be empty' });
  }
  
  // Check if receiver exists
  db.get('SELECT id FROM users WHERE id = ?', [receiverId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const messageId = uuidv4();
    const message = {
      id: messageId,
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      read: 0,
      created_at: new Date().toISOString()
    };
    
    db.run(
      `INSERT INTO direct_messages (id, sender_id, receiver_id, content, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [message.id, message.sender_id, message.receiver_id, message.content, message.read, message.created_at],
      function(err) {
        if (err) {
          console.error('Error sending direct message:', err);
          return res.status(500).json({ message: 'Error sending message' });
        }
        
        // Get sender info to include in the response
        db.get('SELECT username FROM users WHERE id = ?', [senderId], (err, sender) => {
          if (err) {
            console.error('Error fetching sender info:', err);
          }
          
          message.username = sender ? sender.username : 'Unknown User';
          
          // Emit socket event for real-time updates (this will be handled in index.js)
          if (req.io) {
            req.io.to(`user:${receiverId}`).emit('direct_message', message);
          }
          
          return res.status(201).json({ message });
        });
      }
    );
  });
});

module.exports = router;
