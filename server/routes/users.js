const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../database');

const router = express.Router();

// Get all users (can be filtered for search functionality)
router.get('/', (req, res) => {
  const { search } = req.query;
  
  let query = 'SELECT id, username, email, avatar, status FROM users';
  let params = [];
  
  if (search) {
    query += ' WHERE username LIKE ?';
    params.push(`%${search}%`);
  }
  
  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    res.json({ users });
  });
});

// Get a user by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT id, username, email, avatar, status FROM users WHERE id = ?', [id], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  });
});

// Update user profile
router.put('/profile', (req, res) => {
  const { username, avatar, status } = req.body;
  const userId = req.user.id;
  
  // Build dynamic query based on provided fields
  let updateFields = [];
  let params = [];
  
  if (username) {
    updateFields.push('username = ?');
    params.push(username);
  }
  
  if (avatar !== undefined) {
    updateFields.push('avatar = ?');
    params.push(avatar);
  }
  
  if (status) {
    updateFields.push('status = ?');
    params.push(status);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }
  
  params.push(userId); // Add userId for WHERE clause
  
  // Construct and execute the query
  const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
  
  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ message: 'Error updating profile', error: err.message });
    }
    
    // Get the updated user data
    db.get('SELECT id, username, email, avatar, status FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      res.json({
        message: 'Profile updated successfully',
        user
      });
    });
  });
});

// Change password
router.put('/password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }
  
  // Retrieve user with password
  db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating password', error: err.message });
      }
      
      res.json({ message: 'Password updated successfully' });
    });
  });
});

// Get user's direct message contacts
router.get('/contacts/direct', (req, res) => {
  const userId = req.user.id;
  
  // Find all users that have direct message conversations with this user
  db.all(`
    SELECT DISTINCT u.id, u.username, u.avatar, u.status,
      (SELECT MAX(created_at) FROM direct_messages 
       WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)) as last_message_at,
      (SELECT COUNT(*) FROM direct_messages 
       WHERE sender_id = u.id AND receiver_id = ? AND read = 0) as unread_count
    FROM users u
    WHERE u.id IN (
      SELECT DISTINCT 
        CASE 
          WHEN sender_id = ? THEN receiver_id
          WHEN receiver_id = ? THEN sender_id
        END
      FROM direct_messages
      WHERE sender_id = ? OR receiver_id = ?
    )
    ORDER BY last_message_at DESC
  `, [userId, userId, userId, userId, userId, userId, userId], (err, contacts) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    res.json({ contacts });
  });
});

// Get user's servers
router.get('/servers', (req, res) => {
  const userId = req.user.id;
  
  db.all(`
    SELECT s.* 
    FROM servers s
    JOIN server_members sm ON s.id = sm.server_id
    WHERE sm.user_id = ?
  `, [userId], (err, servers) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    res.json({ servers });
  });
});

module.exports = router;
