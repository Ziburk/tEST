const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { initializeDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const directMessageRoutes = require('./routes/directMessages');
const socketHandlers = require('./socketHandlers');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize the database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// Add Socket.io instance to all requests for emitting events from routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// JWT middleware
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }
  
  try {
    const user = jwt.verify(token, 'YOUR_SECRET_KEY'); // Replace with actual secret in production
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', authenticateJWT, serverRoutes);
app.use('/api/channels', authenticateJWT, channelRoutes);
app.use('/api/messages', authenticateJWT, messageRoutes);
app.use('/api/users', authenticateJWT, userRoutes);
app.use('/api/direct-messages', authenticateJWT, directMessageRoutes);

// Socket.io handling
socketHandlers(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
