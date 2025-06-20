const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  try {
    // Check if user already exists
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (user) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      // Insert new user
      db.run(
        'INSERT INTO users (id, username, email, password) VALUES (?, ?, ?, ?)',
        [userId, username, email, hashedPassword],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error creating user', error: err.message });
          }
          
          // Generate JWT token
          const token = jwt.sign(
            { id: userId, username },
            'YOUR_SECRET_KEY', // Replace with actual secret in production
            { expiresIn: '7d' }
          );
          
          res.status(201).json({
            message: 'User created successfully',
            user: { id: userId, username, email },
            token
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login user
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    // Find user by email
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Update user status to online
      db.run('UPDATE users SET status = ? WHERE id = ?', ['online', user.id]);
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        'YOUR_SECRET_KEY', // Replace with actual secret in production
        { expiresIn: '7d' }
      );
      
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          status: 'online'
        },
        token
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
router.get('/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, 'YOUR_SECRET_KEY'); // Replace with actual secret
    
    db.get('SELECT id, username, email, avatar, status FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ user });
    });
  } catch (error) {
    res.status(403).json({ message: 'Invalid token', error: error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, 'YOUR_SECRET_KEY'); // Replace with actual secret
    
    // Update user status to offline
    db.run('UPDATE users SET status = ? WHERE id = ?', ['offline', decoded.id], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    res.status(403).json({ message: 'Invalid token', error: error.message });
  }
});

module.exports = router;
