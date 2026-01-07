const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(helmet());
app.use(limiter);
app.use(express.static(path.join(__dirname, 'public')));

const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

let users = new Map();
let messageHistory = [];
let rooms = new Map();
let typingUsers = new Set();

function sanitizeInput(input) {
  return input.replace(/[<>"'&]/g, '').trim().substring(0, 500);
}

function validateUsername(username) {
  return username && username.length >= 1 && username.length <= 20 && /^[a-zA-Z0-9_\s]+$/.test(username);
}

function generateBotResponse(prompt) {
  const responses = [
    `Great question! ${prompt} is interesting.`,
    `Let me think about ${prompt}...`,
    `${prompt} requires careful consideration.`,
    `That's a creative prompt: ${prompt}`,
    `Analyzing ${prompt} now...`,
    `🤔 Interesting perspective on ${prompt}`,
    `💡 ${prompt} sparks some ideas!`,
    `🚀 Let's explore ${prompt} further`,
    `⭐ ${prompt} is worth discussing`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('user-join', (data) => {
    const cleanUsername = sanitizeInput(data.username);
    const room = data.room || 'general';
    const role = data.role || 'user';
    
    if (!validateUsername(cleanUsername)) {
      socket.emit('error', 'Invalid username');
      return;
    }
    
    socket.username = cleanUsername;
    socket.room = room;
    socket.avatar = data.avatar || '👤';
    socket.role = role;
    socket.status = 'online';
    socket.joinTime = new Date();
    
    users.set(socket.id, {
      username: cleanUsername,
      room: room,
      avatar: socket.avatar,
      role: socket.role,
      status: socket.status,
      joinTime: socket.joinTime
    });
    
    socket.join(room);
    
    const roomUsers = Array.from(users.values()).filter(u => u.room === room);
    io.to(room).emit('user-list', roomUsers);
    socket.emit('message-history', messageHistory.filter(m => m.room === room));
    io.to(room).emit('user-notification', `${socket.avatar} ${cleanUsername} (${role}) joined ${room}`);
  });
  
  socket.on('prompt', (data) => {
    const cleanUser = sanitizeInput(data.user);
    const cleanPrompt = sanitizeInput(data.prompt);
    const room = socket.room || 'general';
    
    if (!validateUsername(cleanUser) || !cleanPrompt) {
      socket.emit('error', 'Invalid input');
      return;
    }
    
    const message = {
      user: cleanUser,
      prompt: cleanPrompt,
      response: generateBotResponse(cleanPrompt),
      timestamp: new Date().toLocaleTimeString(),
      avatar: socket.avatar,
      role: socket.role || 'user',
      room: room,
      id: Date.now(),
      reactions: {},
      isPrivate: data.isPrivate || false
    };
    
    messageHistory.push(message);
    if (messageHistory.length > 100) messageHistory.shift();
    
    if (data.isPrivate && data.targetUser) {
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.username === data.targetUser);
      if (targetSocket) {
        socket.emit('prompt-response', message);
        targetSocket.emit('prompt-response', message);
      }
    } else {
      io.to(room).emit('prompt-response', message);
    }
  });
  
  socket.on('typing', (data) => {
    if (data.user) {
      typingUsers.add(data.user);
      socket.to(socket.room || 'general').emit('user-typing', data);
      setTimeout(() => {
        typingUsers.delete(data.user);
        socket.to(socket.room || 'general').emit('typing-stopped', data.user);
      }, 3000);
    }
  });
  
  socket.on('reaction', (data) => {
    const message = messageHistory.find(m => m.id === data.messageId);
    if (message) {
      if (!message.reactions[data.emoji]) message.reactions[data.emoji] = [];
      const userIndex = message.reactions[data.emoji].indexOf(socket.username);
      if (userIndex === -1) {
        message.reactions[data.emoji].push(socket.username);
      } else {
        message.reactions[data.emoji].splice(userIndex, 1);
      }
      io.to(socket.room || 'general').emit('reaction-update', {
        messageId: data.messageId,
        reactions: message.reactions
      });
    }
  });
  
  socket.on('change-room', (newRoom) => {
    const oldRoom = socket.room;
    socket.leave(oldRoom);
    socket.room = newRoom;
    socket.join(newRoom);
    
    if (users.has(socket.id)) {
      users.get(socket.id).room = newRoom;
      users.get(socket.id).role = socket.role;
    }
    
    const oldRoomUsers = Array.from(users.values()).filter(u => u.room === oldRoom);
    const newRoomUsers = Array.from(users.values()).filter(u => u.room === newRoom);
    
    io.to(oldRoom).emit('user-list', oldRoomUsers);
    io.to(newRoom).emit('user-list', newRoomUsers);
    socket.emit('message-history', messageHistory.filter(m => m.room === newRoom));
    io.to(newRoom).emit('user-notification', `${socket.avatar} ${socket.username} joined ${newRoom}`);
  });
  
  socket.on('status-change', (status) => {
    if (users.has(socket.id)) {
      users.get(socket.id).status = status;
      socket.status = status;
      const roomUsers = Array.from(users.values()).filter(u => u.room === socket.room);
      io.to(socket.room || 'general').emit('user-list', roomUsers);
    }
  });

  socket.on('screen-share-start', (data) => {
    io.to(socket.room || 'general').emit('screen-share-start', data);
  });
  
  socket.on('screen-share-stop', (data) => {
    io.to(socket.room || 'general').emit('screen-share-stop', data);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.id);
      typingUsers.delete(socket.username);
      const roomUsers = Array.from(users.values()).filter(u => u.room === socket.room);
      io.to(socket.room || 'general').emit('user-list', roomUsers);
      io.to(socket.room || 'general').emit('user-notification', `${socket.avatar} ${socket.username} left`);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 7777;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});