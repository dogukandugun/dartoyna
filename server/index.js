const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameStore = require('./game');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const store = new GameStore();

app.use(express.static(path.join(__dirname, '../public')));

store.startCleanupInterval();

io.on('connection', (socket) => {

  socket.on('create-room', ({ playerName } = {}) => {
    const result = store.createRoom(playerName, socket.id);
    if (result.error) return socket.emit('error', { message: result.error });
    socket.join(result.roomCode);
    socket.emit('room-update', sanitize(result.room));
  });

  socket.on('join-room', ({ roomCode, playerName } = {}) => {
    const result = store.joinRoom(roomCode, playerName, socket.id);
    if (result.error) return socket.emit('error', { message: result.error });
    socket.join(roomCode);
    if (result.isReconnect && result.room.status === 'playing') {
      socket.emit('game-update', sanitize(result.room));
    } else {
      io.to(roomCode).emit('room-update', sanitize(result.room));
    }
  });

  socket.on('start-game', ({ mode, legsToWin } = {}) => {
    const roomCode = store.socketToRoom.get(socket.id);
    if (!roomCode) return socket.emit('error', { message: 'Oda bulunamadı' });
    const room = store.rooms.get(roomCode);
    if (room && mode) {
      room.settings.mode = parseInt(mode) || 301;
      room.settings.legsToWin = parseInt(legsToWin) || 1;
    }
    const result = store.startGame(roomCode, socket.id);
    if (result.error) return socket.emit('error', { message: result.error });
    io.to(roomCode).emit('game-update', sanitize(result.room));
  });

  socket.on('submit-score', ({ score } = {}) => {
    const roomCode = store.socketToRoom.get(socket.id);
    if (!roomCode) return socket.emit('error', { message: 'Oda bulunamadı' });
    const result = store.submitScore(roomCode, socket.id, score);
    if (result.error) return socket.emit('error', { message: result.error });

    if (result.bust) {
      const playerName = result.room.players.find(p => p.id === socket.id)?.name || '';
      io.to(roomCode).emit('bust', { playerName });
    }

    if (result.gameOver) {
      io.to(roomCode).emit('game-over', buildGameOverPayload(result.room));
    } else {
      io.to(roomCode).emit('game-update', sanitize(result.room));
    }
  });

  socket.on('disconnect', () => {
    store.handleDisconnect(socket.id);
  });
});

function sanitize(room) {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      legsWon: p.legsWon,
      avg: calcAvg(p.turns),
    })),
    settings: room.settings,
    currentLegIndex: room.currentLegIndex,
    currentPlayerIndex: room.currentPlayerIndex,
    status: room.status,
  };
}

function buildGameOverPayload(room) {
  const winner = room.players.reduce((a, b) => a.legsWon >= b.legsWon ? a : b);
  return {
    winner: winner.name,
    players: room.players.map(p => ({
      name: p.name,
      legsWon: p.legsWon,
      avg: calcAvg(p.turns),
    })),
  };
}

function calcAvg(turns) {
  if (!turns.length) return 0;
  return Math.round(turns.reduce((a, b) => a + b, 0) / turns.length / 3 * 10) / 10;
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Listening on port ${PORT}`));
