const express = require('express');
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all servers for a user
router.get('/', (req, res) => {
  const userId = req.user.id;
  
  const query = `
    SELECT s.* FROM servers s
    JOIN server_members sm ON s.id = sm.server_id
    WHERE sm.user_id = ?
  `;
  
  db.all(query, [userId], (err, servers) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    res.json({ servers });
  });
});

// Create a new server
router.post('/', (req, res) => {
  const { name, icon } = req.body;
  const ownerId = req.user.id;
  
  if (!name) {
    return res.status(400).json({ message: 'Server name is required' });
  }
  
  // Check if a server with this name already exists
  db.get('SELECT * FROM servers WHERE name = ?', [name], (err, existingServer) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (existingServer) {
      return res.status(400).json({ message: 'A server with this name already exists' });
    }
    
    const serverId = uuidv4();
    const inviteCode = uuidv4().substring(0, 8);
  
      // Insert the server
    db.run(
      'INSERT INTO servers (id, name, icon, owner_id, invite_code) VALUES (?, ?, ?, ?, ?)',
      [serverId, name, icon || null, ownerId, inviteCode],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error creating server', error: err.message });
        }
        
        // Add owner as a member with 'owner' role
        db.run(
          'INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)',
          [serverId, ownerId, 'owner'],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Error adding owner to server', error: err.message });
            }
            
            // Create a default "general" text channel
            const generalChannelId = uuidv4();
            db.run(
              'INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)',
              [generalChannelId, serverId, 'general', 'text'],
              function(err) {
                if (err) {
                  return res.status(500).json({ message: 'Error creating general channel', error: err.message });
                }
                
                // Create a default "General" voice channel
                const voiceChannelId = uuidv4();
                db.run(
                  'INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)',
                  [voiceChannelId, serverId, 'General', 'voice'],
                  function(err) {
                    if (err) {
                      return res.status(500).json({ message: 'Error creating voice channel', error: err.message });
                    }
                    
                    res.status(201).json({
                      message: 'Server created successfully',
                      server: {
                        id: serverId,
                        name,
                        icon,
                        owner_id: ownerId,
                        invite_code: inviteCode,
                        channels: [
                          { id: generalChannelId, name: 'general', type: 'text' },
                          { id: voiceChannelId, name: 'General', type: 'voice' }
                        ]
                      }
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// Get a server by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // First check if the user is a member of this server
  db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', [id, userId], (err, member) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!member) {
      return res.status(403).json({ message: 'You are not a member of this server' });
    }
    
    // Get server details
    db.get('SELECT * FROM servers WHERE id = ?', [id], (err, server) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!server) {
        return res.status(404).json({ message: 'Server not found' });
      }
      
      // Get all channels for this server
      db.all('SELECT * FROM channels WHERE server_id = ? ORDER BY type, name', [id], (err, channels) => {
        if (err) {
          return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        // Get all members of this server
        db.all(`
          SELECT u.id, u.username, u.avatar, u.status, sm.role
          FROM users u
          JOIN server_members sm ON u.id = sm.user_id
          WHERE sm.server_id = ?
        `, [id], (err, members) => {
          if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
          }
          
          res.json({
            ...server,
            channels,
            members
          });
        });
      });
    });
  });
});

// Update a server
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, icon } = req.body;
  const userId = req.user.id;
  
  // Check if user is the server owner
  db.get('SELECT * FROM servers WHERE id = ? AND owner_id = ?', [id, userId], (err, server) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!server) {
      return res.status(403).json({ message: 'You do not have permission to update this server' });
    }
    
    // Update the server
    db.run(
      'UPDATE servers SET name = ?, icon = ? WHERE id = ?',
      [name || server.name, icon || server.icon, id],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error updating server', error: err.message });
        }
        
        res.json({
          message: 'Server updated successfully',
          server: {
            ...server,
            name: name || server.name,
            icon: icon || server.icon
          }
        });
      }
    );
  });
});

// Delete a server
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Check if user is the server owner
  db.get('SELECT * FROM servers WHERE id = ? AND owner_id = ?', [id, userId], (err, server) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!server) {
      return res.status(403).json({ message: 'You do not have permission to delete this server' });
    }
    
    // Delete server and cascade to all related records
    db.serialize(() => {
      // Delete all messages in all channels of this server
      db.run(`
        DELETE FROM messages 
        WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)
      `, [id]);
      
      // Delete all voice connections in this server
      db.run(`
        DELETE FROM voice_connections 
        WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)
      `, [id]);
      
      // Delete all channels in this server
      db.run('DELETE FROM channels WHERE server_id = ?', [id]);
      
      // Delete all server members
      db.run('DELETE FROM server_members WHERE server_id = ?', [id]);
      
      // Finally delete the server itself
      db.run('DELETE FROM servers WHERE id = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error deleting server', error: err.message });
        }
        
        res.json({ message: 'Server deleted successfully' });
      });
    });
  });
});

// Join a server via invite code or name
router.post('/join', (req, res) => {
  const { inviteCode, serverName } = req.body;
  const userId = req.user.id;
  
  if (!inviteCode && !serverName) {
    return res.status(400).json({ message: 'Invite code or server name is required' });
  }
  
  // Find the server by invite code or name
  const query = inviteCode 
    ? 'SELECT * FROM servers WHERE invite_code = ?' 
    : 'SELECT * FROM servers WHERE name = ?';
  const param = inviteCode || serverName;
  
  db.get(query, [param], (err, server) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!server) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }
    
    // Check if user is already a member
    db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', [server.id, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (member) {
        return res.status(400).json({ message: 'You are already a member of this server' });
      }
      
      // Add user as a member with 'member' role
      db.run(
        'INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)',
        [server.id, userId, 'member'],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error joining server', error: err.message });
          }
          
          res.status(201).json({
            message: 'Server joined successfully',
            server
          });
        }
      );
    });
  });
});

// Leave a server
router.post('/:id/leave', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Check if user is the server owner
  db.get('SELECT * FROM servers WHERE id = ? AND owner_id = ?', [id, userId], (err, server) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (server) {
      return res.status(400).json({ message: 'Server owner cannot leave. Transfer ownership or delete the server instead.' });
    }
    
    // Check if user is a member
    db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', [id, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!member) {
        return res.status(404).json({ message: 'You are not a member of this server' });
      }
      
      // Remove user from server members
      db.run('DELETE FROM server_members WHERE server_id = ? AND user_id = ?', [id, userId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error leaving server', error: err.message });
        }
        
        res.json({ message: 'Left server successfully' });
      });
    });
  });
});

// Generate a new invite code
router.post('/:id/invite', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Check if user is the server owner or has admin rights
  db.get(`
    SELECT * FROM server_members 
    WHERE server_id = ? AND user_id = ? AND role IN ('owner', 'admin')
  `, [id, userId], (err, member) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!member) {
      return res.status(403).json({ message: 'You do not have permission to generate invite codes' });
    }
    
    const newInviteCode = uuidv4().substring(0, 8);
    
    // Update the invite code
    db.run(
      'UPDATE servers SET invite_code = ? WHERE id = ?',
      [newInviteCode, id],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error generating invite code', error: err.message });
        }
        
        res.json({
          message: 'Invite code generated successfully',
          inviteCode: newInviteCode
        });
      }
    );
  });
});

module.exports = router;
