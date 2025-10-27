const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const aiFriendsRoutes = require('./routes/aiFriends');
const aiDebugRoutes = require('./routes/aiDebug');
const chatsRoutes = require('./routes/chats');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// Global rate limiter: keep reasonably high for demo, but return JSON on limit hit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // send JSON so frontend doesn't throw when trying to parse
    res.status(429).json({ message: 'Too many requests, please slow down.' });
  }
});
app.use(limiter);

app.use('/api/auth', authRoutes);
app.use('/api/ai-friends', aiFriendsRoutes);
app.use('/api/ai', aiDebugRoutes);
app.use('/api/chats', chatsRoutes);

app.get('/', (req, res) => res.send('AI Friend backend is running'));

module.exports = app;
