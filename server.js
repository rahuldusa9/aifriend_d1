require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aifriend_demo';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: '*' } });

    // Simple socket auth/register flow: client sends token and server joins them to a room named by userId
    io.on('connection', (socket) => {
      console.log('Socket connected', socket.id);
      socket.on('register', ({ token }) => {
        try {
          const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
          const uid = String(payload.id);
          socket.join(uid);
          socket.userId = uid;
          console.log('Socket registered user', uid, 'socket', socket.id);
        } catch (e) {
          console.warn('Socket register failed:', e.message);
        }
      });

      socket.on('disconnect', () => {
        // cleanup/log
        // socket.io removes rooms automatically on disconnect
      });
    });

    // expose io on the app so routes can emit events
    app.set('io', io);

    server.listen(PORT, () => console.log(`Server + sockets running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
