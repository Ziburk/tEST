const express = require('express');
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all channels for a server
router.get('/server/:serverId', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;
  
  // Check if user is a member of this server
  db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', [serverId, userId], (err, member) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this server' });
    }
    
    // Get all channels for this server
    db.all('SELECT * FROM channels WHERE server_id = ? ORDER BY type, name', [serverId], (err, channels) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      res.json({ channels });
    });
  });
});

// Create a new channel
router.post('/', (req, res) => {
  const { name, type, serverId } = req.body;
  const userId = req.user.id;
  
  if (!name || !type || !serverId) {
    return res.status(400).json({ message: 'Name, type, and serverId are required' });
  }
  
  if (type !== 'text' && type !== 'voice') {
    return res.status(400).json({ message: 'Type must be "text" or "voice"' });
  }
  
  // Check if user has permission to create channels
  db.get(`
    SELECT * FROM server_members 
    WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')
  `, [serverId, userId], (err, member) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!member) {
      return res.status(403).json({ message: 'You do not have permission to create channels in this server' });
    }
    
    const channelId = uuidv4();
    
    // Create the channel
    db.run(
      'INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)',
      [channelId, serverId, name, type],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error creating channel', error: err.message });
        }
        
        res.status(201).json({
          message: 'Channel created successfully',
          channel: {
            id: channelId,
            server_id: serverId,
            name,
            type
          }
        });
      }
    );
  });
});

// Get a channel by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Get the channel
  db.get('SELECT * FROM channels WHERE id = ?', [id], (err, channel) => {
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
      
      res.json({ channel });
    });
  });
});

// Update a channel
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user.id;
  
  if (!name) {
    return res.status(400).json({ message: 'Channel name is required' });
  }
  
  // Get the channel
  db.get('SELECT * FROM channels WHERE id = ?', [id], (err, channel) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission to update channels
    db.get(`
      SELECT * FROM server_members 
      WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')
    `, [channel.server_id, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!member) {
        return res.status(403).json({ message: 'You do not have permission to update channels in this server' });
      }
      
      // Update the channel
      db.run(
        'UPDATE channels SET name = ? WHERE id = ?',
        [name, id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error updating channel', error: err.message });
          }
          
          res.json({
            message: 'Channel updated successfully',
            channel: {
              ...channel,
              name
            }
          });
        }
      );
    });
  });
});

// Delete a channel
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Get the channel
  db.get('SELECT * FROM channels WHERE id = ?', [id], (err, channel) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Check if user has permission to delete channels
    db.get(`
      SELECT * FROM server_members 
      WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')
    `, [channel.server_id, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!member) {
        return res.status(403).json({ message: 'You do not have permission to delete channels in this server' });
      }
      
      // Delete the channel and all associated data
      db.serialize(() => {
        // Delete all messages in this channel
        db.run('DELETE FROM messages WHERE channel_id = ?', [id]);
        
        // Delete all voice connections in this channel
        db.run('DELETE FROM voice_connections WHERE channel_id = ?', [id]);
        
        // Finally delete the channel itself
        db.run('DELETE FROM channels WHERE id = ?', [id], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error deleting channel', error: err.message });
          }
          
          res.json({ message: 'Channel deleted successfully' });
        });
      });
    });
  });
});

module.exports = router;
