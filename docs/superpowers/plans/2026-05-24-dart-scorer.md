# Dart Scorer Web App — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time multiplayer dart scoring web app accessible via browser, using 4-digit room codes, no accounts, mobile-first UI.

**Architecture:** Node.js + Express + Socket.io server with in-memory game state (no database). Vanilla HTML/CSS/JS single-page app served as static files. All game logic lives on the server; the client only renders state received via Socket.io events.

**Tech Stack:** Node.js 18+, Express 4, Socket.io 4, Jest 29 (tests), nginx, PM2

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | Project config, scripts, dependencies |
| `server/index.js` | HTTP server, Socket.io setup, event wiring |
| `server/game.js` | `GameStore` class — all room/game state mutations |
| `public/index.html` | All views in one HTML file |
| `public/style.css` | Mobile-first styles, dark mode via CSS custom props |
| `public/app.js` | Client SPA: view switching, socket events, UI updates |
| `public/checkouts.js` | Checkout lookup table (sets `window.CHECKOUTS`) |
| `public/manifest.json` | PWA manifest |
| `public/sw.js` | Service worker — offline shell |
| `tests/game.test.js` | Unit tests for `GameStore` |

---

## Chunk 1: Project Setup & Game Logic

### Task 1: Initialize project structure

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `server/game.js` (skeleton)
- Create: `server/index.js` (skeleton)
- Create: `public/index.html` (placeholder)

- [ ] **Step 1: Create directory structure**
```bash
mkdir -p server public tests
```

- [ ] **Step 2: Create `package.json`**
```json
{
  "name": "dartoyna",
  "version": "1.0.0",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "npx nodemon server/index.js",
    "test": "jest --testEnvironment node"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.0"
  }
}
```

- [ ] **Step 3: Install dependencies**
```bash
npm install
```
Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create `.gitignore`**
```
node_modules/
```

- [ ] **Step 5: Create `server/game.js` skeleton**
```js
class GameStore {
  constructor() {
    this.rooms = new Map();           // roomCode -> GameState
    this.socketToRoom = new Map();    // socketId -> roomCode
    this.disconnectTimers = new Map(); // socketId -> timeoutId
  }
}

module.exports = GameStore;
```

- [ ] **Step 6: Create `server/index.js` skeleton**
```js
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

io.on('connection', (socket) => {
  socket.on('create-room', ({ playerName }) => {});
  socket.on('join-room', ({ roomCode, playerName }) => {});
  socket.on('start-game', () => {});
  socket.on('submit-score', ({ score }) => {});
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Listening on port ${PORT}`));
```

- [ ] **Step 7: Create `public/index.html` placeholder**
```html
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Dartoyna</title></head>
<body><p>coming soon</p></body>
</html>
```

- [ ] **Step 8: Start server and verify**
```bash
npm start
```
Expected: `Listening on port 3000`. Open http://localhost:3000 → "coming soon".

- [ ] **Step 9: Commit**
```bash
git init
git add -A
git commit -m "chore: project scaffold"
```

---

### Task 2: GameStore — room creation

**Files:**
- Modify: `server/game.js`
- Create: `tests/game.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/game.test.js`:
```js
const GameStore = require('../server/game');

describe('GameStore.createRoom', () => {
  let store;
  beforeEach(() => { store = new GameStore(); });

  test('returns a 4-digit room code', () => {
    const { roomCode } = store.createRoom('Ali', 'socket-1');
    expect(roomCode).toMatch(/^\d{4}$/);
  });

  test('creates a room in lobby status', () => {
    const { roomCode } = store.createRoom('Ali', 'socket-1');
    const room = store.rooms.get(roomCode);
    expect(room.status).toBe('lobby');
  });

  test('adds creator as first player', () => {
    const { roomCode } = store.createRoom('Ali', 'socket-1');
    const room = store.rooms.get(roomCode);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].name).toBe('Ali');
    expect(room.players[0].id).toBe('socket-1');
  });

  test('creator is the host', () => {
    const { roomCode } = store.createRoom('Ali', 'socket-1');
    const room = store.rooms.get(roomCode);
    expect(room.hostId).toBe('socket-1');
  });

  test('different rooms get different codes', () => {
    const { roomCode: c1 } = store.createRoom('Ali', 'socket-1');
    const { roomCode: c2 } = store.createRoom('Veli', 'socket-2');
    expect(c1).not.toBe(c2);
  });

  test('rejects empty player name', () => {
    const result = store.createRoom('', 'socket-1');
    expect(result.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**
```bash
npm test
```
Expected: `TypeError: store.createRoom is not a function`

- [ ] **Step 3: Implement `createRoom` in `server/game.js`**
```js
class GameStore {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.disconnectTimers = new Map();
  }

  _generateCode() {
    for (let i = 0; i < 100; i++) {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }

  createRoom(playerName, socketId) {
    if (!playerName || !playerName.trim()) return { error: 'İsim gerekli' };
    if (playerName.trim().length > 30) return { error: 'İsim en fazla 30 karakter olabilir' };
    const roomCode = this._generateCode();
    if (!roomCode) return { error: 'Oda oluşturulamadı' };

    const player = { id: socketId, name: playerName.trim(), score: 0, legsWon: 0, turns: [] };
    const room = {
      roomCode,
      hostId: socketId,
      players: [player],
      settings: { mode: 301, legsToWin: 1 },
      currentLegIndex: 0,
      currentPlayerIndex: 0,
      firstPlayerThisLeg: 0,
      status: 'lobby',
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
    };

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(socketId, roomCode);
    return { roomCode, room };
  }
}

module.exports = GameStore;
```

- [ ] **Step 4: Run tests — expect PASS**
```bash
npm test
```
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: GameStore createRoom"
```

---

### Task 3: GameStore — join room

**Files:**
- Modify: `server/game.js`
- Modify: `tests/game.test.js`

- [ ] **Step 1: Write failing tests** — append to `tests/game.test.js`:
```js
describe('GameStore.joinRoom', () => {
  let store, roomCode;
  beforeEach(() => {
    store = new GameStore();
    ({ roomCode } = store.createRoom('Ali', 'socket-1'));
  });

  test('adds new player to lobby', () => {
    const { room } = store.joinRoom(roomCode, 'Veli', 'socket-2');
    expect(room.players).toHaveLength(2);
    expect(room.players[1].name).toBe('Veli');
  });

  test('returns error for unknown room code', () => {
    const result = store.joinRoom('0000', 'Veli', 'socket-2');
    expect(result.error).toBeTruthy();
  });

  test('returns error when room is full (>8 players)', () => {
    for (let i = 2; i <= 8; i++) store.joinRoom(roomCode, `P${i}`, `s-${i}`);
    const result = store.joinRoom(roomCode, 'Extra', 'socket-9');
    expect(result.error).toBeTruthy();
  });

  test('reconnects player by matching name during playing status', () => {
    store.joinRoom(roomCode, 'Veli', 'socket-2');
    store.startGame(roomCode, 'socket-1');
    const { isReconnect } = store.joinRoom(roomCode, 'Veli', 'socket-2b');
    expect(isReconnect).toBe(true);
    const room = store.rooms.get(roomCode);
    expect(room.players[1].id).toBe('socket-2b');
  });

  test('returns error for duplicate name in lobby', () => {
    const result = store.joinRoom(roomCode, 'Ali', 'socket-2');
    expect(result.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**
```bash
npm test
```

- [ ] **Step 3: Implement `joinRoom`** — add to `GameStore` class:
```js
joinRoom(roomCode, playerName, socketId) {
  if (!playerName || !playerName.trim()) return { error: 'İsim gerekli' };
  if (playerName.trim().length > 30) return { error: 'İsim en fazla 30 karakter olabilir' };
  const room = this.rooms.get(roomCode);
  if (!room) return { error: 'Oda bulunamadı' };

  const trimmed = playerName.trim();

  if (room.status === 'playing' || room.status === 'finished') {
    const existing = room.players.find(p => p.name === trimmed);
    if (existing) {
      if (this.disconnectTimers.has(existing.id)) {
        clearTimeout(this.disconnectTimers.get(existing.id));
        this.disconnectTimers.delete(existing.id);
      }
      this.socketToRoom.delete(existing.id);
      existing.id = socketId;
      this.socketToRoom.set(socketId, roomCode);
      room.lastActivityAt = Date.now();
      return { room, isReconnect: true };
    }
    return { error: 'Oyun devam ediyor' };
  }

  if (room.players.length >= 8) return { error: 'Oda dolu (max 8)' };
  if (room.players.find(p => p.name === trimmed)) return { error: 'Bu isim kullanımda' };

  const player = { id: socketId, name: trimmed, score: 0, legsWon: 0, turns: [] };
  room.players.push(player);
  this.socketToRoom.set(socketId, roomCode);
  room.lastActivityAt = Date.now();
  return { room };
}
```

- [ ] **Step 4: Run tests — expect PASS**
```bash
npm test
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: GameStore joinRoom"
```

---

### Task 4: GameStore — start game

**Files:**
- Modify: `server/game.js`
- Modify: `tests/game.test.js`

- [ ] **Step 1: Write failing tests** — append to `tests/game.test.js`:
```js
describe('GameStore.startGame', () => {
  let store, roomCode;
  beforeEach(() => {
    store = new GameStore();
    ({ roomCode } = store.createRoom('Ali', 'socket-1'));
    store.joinRoom(roomCode, 'Veli', 'socket-2');
  });

  test('starts game with valid host and 2+ players', () => {
    const { room } = store.startGame(roomCode, 'socket-1');
    expect(room.status).toBe('playing');
  });

  test('initializes player scores to game mode', () => {
    store.rooms.get(roomCode).settings = { mode: 301, legsToWin: 1 };
    const { room } = store.startGame(roomCode, 'socket-1');
    room.players.forEach(p => expect(p.score).toBe(301));
  });

  test('rejects non-host start', () => {
    const result = store.startGame(roomCode, 'socket-2');
    expect(result.error).toBeTruthy();
  });

  test('rejects start with only 1 player', () => {
    const store2 = new GameStore();
    const { roomCode: rc } = store2.createRoom('Solo', 'socket-1');
    const result = store2.startGame(rc, 'socket-1');
    expect(result.error).toBeTruthy();
  });

  test('sets currentPlayerIndex to a valid index', () => {
    const { room } = store.startGame(roomCode, 'socket-1');
    expect(room.currentPlayerIndex).toBeGreaterThanOrEqual(0);
    expect(room.currentPlayerIndex).toBeLessThan(room.players.length);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**
```bash
npm test
```

- [ ] **Step 3: Implement `startGame`** — add to `GameStore` class:
```js
startGame(roomCode, socketId) {
  const room = this.rooms.get(roomCode);
  if (!room) return { error: 'Oda bulunamadı' };
  if (room.hostId !== socketId) return { error: 'Sadece oda sahibi başlatabilir' };
  if (room.players.length < 2) return { error: 'En az 2 oyuncu gerekli' };

  const firstIdx = Math.floor(Math.random() * room.players.length);
  room.players.forEach(p => {
    p.score = room.settings.mode;
    p.legsWon = 0;
    p.turns = [];
  });
  room.currentLegIndex = 0;
  room.currentPlayerIndex = firstIdx;
  room.firstPlayerThisLeg = firstIdx;
  room.status = 'playing';
  room.lastActivityAt = Date.now();
  return { room };
}
```

- [ ] **Step 4: Run tests — expect PASS**
```bash
npm test
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: GameStore startGame"
```

---

### Task 5: GameStore — submit score

**Files:**
- Modify: `server/game.js`
- Modify: `tests/game.test.js`

- [ ] **Step 1: Write failing tests** — append to `tests/game.test.js`:
```js
describe('GameStore.submitScore', () => {
  let store, roomCode;
  beforeEach(() => {
    store = new GameStore();
    ({ roomCode } = store.createRoom('Ali', 'socket-1'));
    store.joinRoom(roomCode, 'Veli', 'socket-2');
    // Force player 0 to go first for deterministic tests
    const room = store.rooms.get(roomCode);
    room.settings = { mode: 301, legsToWin: 2 };
    store.startGame(roomCode, 'socket-1');
    store.rooms.get(roomCode).currentPlayerIndex = 0;
    store.rooms.get(roomCode).firstPlayerThisLeg = 0;
    store.rooms.get(roomCode).players.forEach(p => p.score = 301);
  });

  test('reduces score by submitted amount', () => {
    const { room } = store.submitScore(roomCode, 'socket-1', 60);
    expect(room.players[0].score).toBe(241);
  });

  test('advances to next player after valid score', () => {
    store.submitScore(roomCode, 'socket-1', 60);
    const room = store.rooms.get(roomCode);
    expect(room.currentPlayerIndex).toBe(1);
  });

  test('bust: score greater than remaining restores score and advances turn', () => {
    store.rooms.get(roomCode).players[0].score = 20;
    const { bust, room } = store.submitScore(roomCode, 'socket-1', 30);
    expect(bust).toBe(true);
    expect(room.players[0].score).toBe(20);
    expect(room.currentPlayerIndex).toBe(1);
  });

  test('leg won when score reaches exactly 0', () => {
    store.rooms.get(roomCode).players[0].score = 60;
    const { legWon } = store.submitScore(roomCode, 'socket-1', 60);
    expect(legWon).toBe(true);
  });

  test('game over when player wins enough legs', () => {
    // Simulate player 0 winning legsToWin-1 legs already
    store.rooms.get(roomCode).players[0].legsWon = 1;
    store.rooms.get(roomCode).players[0].score = 60;
    const { gameOver } = store.submitScore(roomCode, 'socket-1', 60);
    expect(gameOver).toBe(true);
  });

  test('score of 0 is a valid no-score turn, advances without legWon', () => {
    const { room, bust, legWon } = store.submitScore(roomCode, 'socket-1', 0);
    expect(bust).toBeFalsy();
    expect(legWon).toBeFalsy();
    expect(room.players[0].score).toBe(301);
    expect(room.currentPlayerIndex).toBe(1);
  });

  test('rejects submitScore when game is finished', () => {
    store.rooms.get(roomCode).status = 'finished';
    const result = store.submitScore(roomCode, 'socket-1', 60);
    expect(result.error).toBeTruthy();
  });

  test('rejects score outside [0, 180]', () => {
    const result = store.submitScore(roomCode, 'socket-1', 181);
    expect(result.error).toBeTruthy();
  });

  test('rejects score from wrong player', () => {
    const result = store.submitScore(roomCode, 'socket-2', 60);
    expect(result.error).toBeTruthy();
  });

  test('records turn in turns array', () => {
    store.submitScore(roomCode, 'socket-1', 60);
    const room = store.rooms.get(roomCode);
    expect(room.players[0].turns).toContain(60);
  });

  test('bust turn is still recorded in turns array', () => {
    store.rooms.get(roomCode).players[0].score = 20;
    store.submitScore(roomCode, 'socket-1', 30);
    const room = store.rooms.get(roomCode);
    expect(room.players[0].turns).toContain(30);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**
```bash
npm test
```

- [ ] **Step 3: Implement `submitScore`** — add to `GameStore` class:
```js
submitScore(roomCode, socketId, score) {
  const room = this.rooms.get(roomCode);
  if (!room || room.status !== 'playing') return { error: 'Oyun yok' };

  const player = room.players[room.currentPlayerIndex];
  if (player.id !== socketId) return { error: 'Sıra sende değil' };
  if (typeof score !== 'number' || score < 0 || score > 180) return { error: 'Geçersiz skor (0-180)' };

  room.lastActivityAt = Date.now();
  player.turns.push(score);

  const remaining = player.score - score;

  // Bust
  if (remaining < 0) {
    this._advanceTurn(room);
    return { room, bust: true };
  }

  player.score = remaining;

  // Leg won
  if (remaining === 0) {
    player.legsWon++;
    if (player.legsWon >= room.settings.legsToWin) {
      room.status = 'finished';
      return { room, legWon: true, gameOver: true };
    }
    this._startNewLeg(room);
    return { room, legWon: true };
  }

  this._advanceTurn(room);
  return { room };
}

_advanceTurn(room) {
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
}

_startNewLeg(room) {
  room.currentLegIndex++;
  // The winner is the player who just hit 0. The next leg starts with the player
  // immediately after the winner in rotation order. For 2 players this is the loser;
  // for 3+ players it is the "first non-winner" — a simple fair rule for casual play.
  const winnerIdx = room.currentPlayerIndex;
  room.firstPlayerThisLeg = (winnerIdx + 1) % room.players.length;
  room.currentPlayerIndex = room.firstPlayerThisLeg;
  room.players.forEach(p => { p.score = room.settings.mode; });
}
```

- [ ] **Step 4: Run tests — expect PASS**
```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: GameStore submitScore with bust and leg logic"
```

---

### Task 6: GameStore — disconnect handling & cleanup

**Files:**
- Modify: `server/game.js`
- Modify: `tests/game.test.js`

- [ ] **Step 1: Write failing tests** — append to `tests/game.test.js`:
```js
describe('GameStore.handleDisconnect', () => {
  let store, roomCode;
  beforeEach(() => {
    jest.useFakeTimers();
    store = new GameStore();
    ({ roomCode } = store.createRoom('Ali', 'socket-1'));
    store.joinRoom(roomCode, 'Veli', 'socket-2');
    store.startGame(roomCode, 'socket-1');
    store.rooms.get(roomCode).currentPlayerIndex = 0;
    store.rooms.get(roomCode).players.forEach(p => p.score = 301);
  });
  afterEach(() => jest.useRealTimers());

  test('sets a disconnect timer for the socket', () => {
    store.handleDisconnect('socket-1');
    expect(store.disconnectTimers.has('socket-1')).toBe(true);
  });

  test('advances turn after 3-minute timeout if it was that player\'s turn', () => {
    store.rooms.get(roomCode).currentPlayerIndex = 0; // Ali's turn
    store.handleDisconnect('socket-1');
    jest.advanceTimersByTime(3 * 60 * 1000);
    const room = store.rooms.get(roomCode);
    expect(room.currentPlayerIndex).toBe(1);
  });

  test('deletes room if all players disconnect after timers fire', () => {
    store.handleDisconnect('socket-1');
    store.handleDisconnect('socket-2');
    jest.advanceTimersByTime(3 * 60 * 1000);
    expect(store.rooms.has(roomCode)).toBe(false);
  });

  test('disconnect timer is cleared when player reconnects', () => {
    store.handleDisconnect('socket-1');
    expect(store.disconnectTimers.has('socket-1')).toBe(true);
    store.joinRoom(roomCode, 'Ali', 'socket-1b'); // reconnect by name
    expect(store.disconnectTimers.has('socket-1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**
```bash
npm test
```

- [ ] **Step 3: Implement `handleDisconnect` and `startCleanupInterval`** — add to `GameStore` class:
```js
handleDisconnect(socketId) {
  const roomCode = this.socketToRoom.get(socketId);
  if (!roomCode) return;

  const timer = setTimeout(() => {
    this.disconnectTimers.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    // Delete mapping AFTER counting, so the count is correct
    this.socketToRoom.delete(socketId);
    const activeCount = room.players.filter(p => this.socketToRoom.has(p.id)).length;

    if (activeCount === 0) {
      this.rooms.delete(roomCode);
      return;
    }

    // If it was this player's turn, advance
    if (room.status === 'playing') {
      const player = room.players[room.currentPlayerIndex];
      if (player && player.id === socketId) {
        this._advanceTurn(room);
      }
    }
  }, 3 * 60 * 1000);

  this.disconnectTimers.set(socketId, timer);
}

startCleanupInterval() {
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const age = now - room.lastActivityAt;
      const finishedAge = room.status === 'finished' ? now - room.lastActivityAt : 0;
      if (age > 60 * 60 * 1000 || finishedAge > 5 * 60 * 1000) {
        this.rooms.delete(code);
      }
    }
  }, 5 * 60 * 1000);
}
```

- [ ] **Step 4: Run tests — expect PASS**
```bash
npm test
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: GameStore disconnect handling and room cleanup"
```

---

## Chunk 2: Socket.io Event Wiring

### Task 7: Wire Socket.io events

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Replace `server/index.js` with full implementation**
```js
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

  socket.on('start-game', () => {
    const roomCode = store.socketToRoom.get(socket.id);
    if (!roomCode) return socket.emit('error', { message: 'Oda bulunamadı' });
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
```

- [ ] **Step 2: Start server and verify no errors**
```bash
npm start
```
Expected: `Listening on port 3000`, no crashes.

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: Socket.io event wiring"
```

---

## Chunk 3: Frontend

### Task 8: HTML structure

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Write full `public/index.html`**

```html
<!DOCTYPE html>
<html lang="tr" data-theme="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#1a1a2e">
  <title>Dartoyna</title>
  <link rel="stylesheet" href="style.css">
  <link rel="manifest" href="manifest.json">
</head>
<body>

  <!-- VIEW: Home -->
  <div id="view-home" class="view active">
    <div class="logo">🎯 Dartoyna</div>
    <div class="card">
      <input id="home-name" class="input" type="text" placeholder="Adın" maxlength="20" autocomplete="off">
      <button id="btn-create" class="btn btn-primary">Oyun Oluştur</button>
      <div class="divider">veya</div>
      <input id="home-code" class="input" type="text" placeholder="Oda Kodu (4 hane)" maxlength="4" pattern="\d{4}" inputmode="numeric">
      <button id="btn-join" class="btn btn-secondary">Oyuna Katıl</button>
    </div>
    <p id="home-error" class="error hidden"></p>
  </div>

  <!-- VIEW: Lobby -->
  <div id="view-lobby" class="view">
    <div class="room-code-display">
      Oda Kodu: <span id="lobby-code" class="code-badge"></span>
    </div>
    <p class="hint">Arkadaşların bu kodu girsin</p>

    <div id="lobby-players" class="player-list"></div>

    <div id="lobby-settings" class="settings-panel hidden">
      <label>Mod
        <select id="setting-mode">
          <option value="101">101</option>
          <option value="201">201</option>
          <option value="301" selected>301</option>
          <option value="501">501</option>
        </select>
      </label>
      <label>Format
        <select id="setting-format">
          <option value="1">BO1</option>
          <option value="2" selected>BO3</option>
          <option value="3">BO5</option>
        </select>
      </label>
      <button id="btn-start" class="btn btn-primary">Oyunu Başlat</button>
    </div>

    <p class="hint" id="lobby-waiting-msg">Host oyunu başlatmayı bekliyor...</p>
    <p id="lobby-error" class="error hidden"></p>
  </div>

  <!-- VIEW: Game -->
  <div id="view-game" class="view">
    <div id="game-players" class="players-row"></div>

    <div class="turn-info">
      <div id="turn-label" class="turn-label"></div>
      <div id="checkout-hint" class="checkout-hint"></div>
    </div>

    <div class="score-entry">
      <input id="score-input" class="score-input" type="number" inputmode="numeric" min="0" max="180" placeholder="0">
      <button id="btn-submit-score" class="btn btn-primary btn-big">Gönder</button>
    </div>

    <div id="bust-msg" class="bust-msg hidden">BUST!</div>

    <div id="averages" class="averages"></div>
  </div>

  <!-- VIEW: Game Over -->
  <div id="view-gameover" class="view">
    <div class="winner-banner">
      🏆 <span id="winner-name"></span> kazandı!
    </div>
    <div id="gameover-stats" class="stats-list"></div>
    <button id="btn-share" class="btn btn-secondary">Paylaş</button>
    <button id="btn-new-game" class="btn btn-primary">Yeni Oyun</button>
  </div>

  <!-- Dark mode toggle (always visible) -->
  <button id="btn-theme" class="theme-toggle" aria-label="Tema değiştir">🌙</button>

  <script src="checkouts.js"></script>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**
```bash
git add public/index.html && git commit -m "feat: HTML structure for all views"
```

---

### Task 9: CSS styles

**Files:**
- Create: `public/style.css`

- [ ] **Step 1: Write `public/style.css`**

```css
:root {
  --bg: #f5f5f5;
  --surface: #ffffff;
  --text: #1a1a1a;
  --text-muted: #666;
  --accent: #e63946;
  --accent-2: #457b9d;
  --border: #ddd;
  --radius: 12px;
  --shadow: 0 2px 12px rgba(0,0,0,0.08);
}

[data-theme="dark"] {
  --bg: #0f0f1a;
  --surface: #1a1a2e;
  --text: #e0e0e0;
  --text-muted: #888;
  --accent: #e63946;
  --accent-2: #457b9d;
  --border: #2a2a3e;
  --shadow: 0 2px 12px rgba(0,0,0,0.4);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  transition: background 0.2s, color 0.2s;
}

.view { display: none; width: 100%; max-width: 480px; flex-direction: column; gap: 1rem; }
.view.active { display: flex; }

.logo { font-size: 2rem; font-weight: 800; text-align: center; margin: 1.5rem 0; }

.card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input, select {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}
.input:focus, select:focus { border-color: var(--accent); }

.btn {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.btn:active { transform: scale(0.98); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: var(--accent-2); color: #fff; }
.btn-big { padding: 1.25rem; font-size: 1.25rem; }

.divider { text-align: center; color: var(--text-muted); font-size: 0.875rem; }

.error { color: var(--accent); font-size: 0.9rem; text-align: center; }
.hidden { display: none !important; }

/* Lobby */
.room-code-display { font-size: 1.1rem; text-align: center; }
.code-badge {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
}
.hint { text-align: center; color: var(--text-muted); font-size: 0.9rem; }

.player-list { display: flex; flex-direction: column; gap: 0.5rem; }
.player-chip {
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.player-chip.host::after { content: ' 👑'; }

.settings-panel { display: flex; flex-direction: column; gap: 0.75rem; }
.settings-panel label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: var(--text-muted); }

/* Game view */
.players-row { display: flex; gap: 0.75rem; }
.player-card {
  flex: 1;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: var(--shadow);
  text-align: center;
  border: 3px solid transparent;
  transition: border-color 0.2s;
}
.player-card.active { border-color: var(--accent); }
.player-card .p-name { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.player-card .p-score { font-size: 2.5rem; font-weight: 900; line-height: 1; }
.player-card .p-legs { font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem; }

.turn-info { text-align: center; }
.turn-label { font-size: 1.1rem; font-weight: 700; }
.checkout-hint { font-size: 0.9rem; color: var(--accent-2); margin-top: 0.25rem; min-height: 1.2em; }

.score-entry { display: flex; gap: 0.75rem; }
.score-input {
  flex: 1;
  padding: 1rem;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  background: var(--surface);
  color: var(--text);
  outline: none;
}
.score-input:focus { border-color: var(--accent); }

.bust-msg {
  text-align: center;
  font-size: 2rem;
  font-weight: 900;
  color: var(--accent);
  animation: pop 0.4s ease;
}
@keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }

.averages { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.avg-chip {
  background: var(--surface);
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  border: 1px solid var(--border);
}

/* Game over */
.winner-banner { font-size: 1.75rem; font-weight: 900; text-align: center; padding: 1rem; }
.stats-list { display: flex; flex-direction: column; gap: 0.5rem; }
.stat-row {
  background: var(--surface);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
}

/* Theme toggle */
.theme-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
}
```

- [ ] **Step 2: Commit**
```bash
git add public/style.css && git commit -m "feat: CSS styles with dark mode"
```

---

### Task 10: Checkout lookup table

**Files:**
- Create: `public/checkouts.js`

- [ ] **Step 1: Write `public/checkouts.js`**

```js
(function () {
  const SINGLES = Array.from({ length: 20 }, (_, i) => ({ name: String(i + 1), val: i + 1 }));
  const DOUBLES = Array.from({ length: 20 }, (_, i) => ({ name: `D${i + 1}`, val: (i + 1) * 2 }));
  const TREBLES = Array.from({ length: 20 }, (_, i) => ({ name: `T${i + 1}`, val: (i + 1) * 3 }));
  const SPECIAL = [{ name: 'Bull', val: 25 }, { name: 'D-Bull', val: 50 }];
  const DARTS = [...TREBLES, ...DOUBLES, ...SPECIAL, ...SINGLES].sort((a, b) => b.val - a.val);

  const CHECKOUTS = {};

  for (let score = 1; score <= 180; score++) {
    // 1 dart
    const d1 = DARTS.find(d => d.val === score);
    if (d1) { CHECKOUTS[score] = d1.name; continue; }

    // 2 darts
    let found = false;
    for (const a of DARTS) {
      if (a.val >= score) continue;
      const b = DARTS.find(d => d.val === score - a.val);
      if (b) { CHECKOUTS[score] = `${a.name} ${b.name}`; found = true; break; }
    }
    if (found) continue;

    // 3 darts
    for (const a of DARTS) {
      if (a.val >= score) continue;
      const r1 = score - a.val;
      for (const b of DARTS) {
        if (b.val >= r1) continue;
        const c = DARTS.find(d => d.val === r1 - b.val);
        if (c) { CHECKOUTS[score] = `${a.name} ${b.name} ${c.name}`; found = true; break; }
      }
      if (found) break;
    }
  }

  window.CHECKOUTS = CHECKOUTS;
})();
```

- [ ] **Step 2: Commit**
```bash
git add public/checkouts.js && git commit -m "feat: checkout lookup table"
```

---

### Task 11: Client SPA logic

**Files:**
- Create: `public/app.js`

- [ ] **Step 1: Write `public/app.js`**

```js
const socket = io();
let myName = '';
let myRoomCode = '';
let isHost = false;
let lastGameState = null;

// ── View switching ────────────────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Dark mode ─────────────────────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const html = document.documentElement;
  if (saved) {
    html.setAttribute('data-theme', saved);
  } else {
    html.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('btn-theme').textContent = next === 'dark' ? '☀️' : '🌙';
  });
})();

// ── Home view ─────────────────────────────────────────────────────────────────
document.getElementById('btn-create').addEventListener('click', () => {
  const name = document.getElementById('home-name').value.trim();
  if (!name) return showError('home-error', 'Adını gir');
  myName = name;
  socket.emit('create-room', { playerName: name });
});

document.getElementById('btn-join').addEventListener('click', () => {
  const name = document.getElementById('home-name').value.trim();
  const code = document.getElementById('home-code').value.trim();
  if (!name) return showError('home-error', 'Adını gir');
  if (!/^\d{4}$/.test(code)) return showError('home-error', 'Geçerli 4 haneli kod gir');
  myName = name;
  myRoomCode = code;
  socket.emit('join-room', { roomCode: code, playerName: name });
});

document.getElementById('home-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// ── Lobby view ────────────────────────────────────────────────────────────────
document.getElementById('lobby-code').addEventListener('click', () => {
  navigator.clipboard.writeText(myRoomCode).catch(() => {});
});

document.getElementById('btn-start').addEventListener('click', () => {
  const mode = parseInt(document.getElementById('setting-mode').value);
  const legsToWin = parseInt(document.getElementById('setting-format').value);
  // Update settings via a dedicated event (server uses last settings from startGame)
  socket.emit('start-game', { mode, legsToWin });
});

// ── Game view ─────────────────────────────────────────────────────────────────
document.getElementById('btn-submit-score').addEventListener('click', submitScore);
document.getElementById('score-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitScore();
});

function submitScore() {
  const val = parseInt(document.getElementById('score-input').value);
  if (isNaN(val) || val < 0 || val > 180) return;
  socket.emit('submit-score', { score: val });
  document.getElementById('score-input').value = '';
}

// ── Game over view ─────────────────────────────────────────────────────────────
document.getElementById('btn-new-game').addEventListener('click', () => {
  showView('view-home');
  myRoomCode = '';
  isHost = false;
  lastGameState = null;
});

document.getElementById('btn-share').addEventListener('click', () => {
  if (!lastGameState) return;
  const { winner, players } = lastGameState;
  const lines = players.map(p => `${p.name}: ${p.legsWon} leg, ort ${p.avg}`).join('\n');
  const text = `🎯 Dartoyna Sonucu\n${winner} kazandı!\n\n${lines}`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).catch(() => {});
    alert('Sonuç kopyalandı!');
  }
});

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('room-update', (room) => {
  myRoomCode = room.roomCode;
  isHost = room.hostId === socket.id;
  renderLobby(room);
  showView('view-lobby');
});

socket.on('game-update', (state) => {
  renderGame(state);
  showView('view-game');
});

socket.on('game-over', (data) => {
  lastGameState = data;
  renderGameOver(data);
  showView('view-gameover');
});

socket.on('error', ({ message }) => {
  // Show error in the currently active view
  const active = document.querySelector('.view.active');
  const errEl = active && active.querySelector('.error');
  if (errEl) showError(errEl.id, message);
  else alert(message);
});

// ── Render functions ──────────────────────────────────────────────────────────
function renderLobby(room) {
  document.getElementById('lobby-code').textContent = room.roomCode;

  const list = document.getElementById('lobby-players');
  list.innerHTML = room.players.map(p => {
    const isHostPlayer = p.id === room.hostId;
    return `<div class="player-chip${isHostPlayer ? ' host' : ''}">${esc(p.name)}</div>`;
  }).join('');

  const settingsPanel = document.getElementById('lobby-settings');
  const waitingMsg = document.getElementById('lobby-waiting-msg');
  if (isHost) {
    settingsPanel.classList.remove('hidden');
    waitingMsg.classList.add('hidden');
  } else {
    settingsPanel.classList.add('hidden');
    waitingMsg.classList.remove('hidden');
  }
}

function renderGame(state) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMeTurn = currentPlayer && currentPlayer.id === socket.id;

  // Player cards
  const row = document.getElementById('game-players');
  row.innerHTML = state.players.map((p, i) => `
    <div class="player-card ${i === state.currentPlayerIndex ? 'active' : ''}">
      <div class="p-name">${esc(p.name)}</div>
      <div class="p-score">${p.score}</div>
      <div class="p-legs">${'●'.repeat(p.legsWon)}${'○'.repeat(state.settings.legsToWin - p.legsWon)}</div>
    </div>
  `).join('');

  // Turn label
  document.getElementById('turn-label').textContent =
    isMeTurn ? 'Senin sıran!' : `${currentPlayer ? currentPlayer.name : ''} atıyor...`;

  // Checkout hint
  const score = currentPlayer ? currentPlayer.score : 0;
  const checkout = window.CHECKOUTS && window.CHECKOUTS[score];
  const hintEl = document.getElementById('checkout-hint');
  if (checkout && score <= 180) {
    hintEl.textContent = `Finish: ${checkout}`;
  } else {
    hintEl.textContent = '';
  }

  // Score input
  document.getElementById('score-input').disabled = !isMeTurn;
  document.getElementById('btn-submit-score').disabled = !isMeTurn;
  if (isMeTurn) document.getElementById('score-input').focus();

  // Averages
  const avgs = document.getElementById('averages');
  avgs.innerHTML = state.players.map(p =>
    `<span class="avg-chip">${esc(p.name)}: ort ${p.avg}</span>`
  ).join('');
}

function renderGameOver(data) {
  document.getElementById('winner-name').textContent = data.winner;
  const stats = document.getElementById('gameover-stats');
  stats.innerHTML = data.players.map(p => `
    <div class="stat-row">
      <span>${esc(p.name)}</span>
      <span>${p.legsWon} leg · ort ${p.avg}</span>
    </div>
  `).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

- [ ] **Step 2: Update `server/index.js` to accept mode/legsToWin from `start-game` event**

In `server/index.js`, update the `start-game` handler:
```js
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
```

- [ ] **Step 3: Test full flow manually**
  1. Open http://localhost:3000 in two browser tabs
  2. Tab 1: Enter name, click "Oyun Oluştur" → should show lobby with room code
  3. Tab 2: Enter name + room code, click "Oyuna Katıl" → both tabs show lobby with 2 players
  4. Tab 1 (host): Select mode/format, click "Oyunu Başlat" → both tabs show game screen
  5. Active player enters score, clicks "Gönder" → score updates in both tabs
  6. Continue until a player wins → game over screen appears

- [ ] **Step 4: Add `bust` event listener to `app.js`** — server already emits this from Task 7:
```js
socket.on('bust', ({ playerName }) => {
  const bustEl = document.getElementById('bust-msg');
  bustEl.textContent = `${playerName} BUST!`;
  bustEl.classList.remove('hidden');
  setTimeout(() => bustEl.classList.add('hidden'), 2000);
});
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: client SPA — all views and socket integration"
```

---

## Chunk 4: PWA + Deployment

### Task 12: PWA setup

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`

- [ ] **Step 1: Create `public/manifest.json`**
```json
{
  "name": "Dartoyna",
  "short_name": "Dartoyna",
  "description": "Arkadaşlarla online dart sayacı",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f1a",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Generate placeholder icons using Node.js**

Run this one-time script to create minimal PNG icons:
```bash
npm install --save-dev canvas
node -e "
const { createCanvas } = require('canvas');
const fs = require('fs');
[192, 512].forEach(size => {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#e63946';
  ctx.font = \`bold \${size * 0.5}px serif\`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎯', size / 2, size / 2);
  fs.writeFileSync(\`public/icon-\${size}.png\`, c.toBuffer('image/png'));
  console.log('Created icon-' + size + '.png');
});
"
```

If `canvas` fails to install (native deps), download any 192×192 and 512×512 PNG from the internet and rename them. The icons just need to exist for the PWA manifest to validate.

- [ ] **Step 3: Create `public/sw.js`**
```js
const CACHE = 'dartoyna-v1';
const SHELL = ['/', '/style.css', '/app.js', '/checkouts.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/socket.io/')) return; // never cache websocket
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() =>
      new Response('<h2>İnternet bağlantısı gerekli</h2>', { headers: { 'Content-Type': 'text/html' } })
    ))
  );
});
```

- [ ] **Step 4: Register service worker in `public/app.js`** — add at the top:
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
```

- [ ] **Step 5: Test PWA**
  1. Open Chrome DevTools → Application → Manifest → verify it loads
  2. Application → Service Workers → verify registered
  3. On mobile Chrome: tap browser menu → "Ana ekrana ekle" → should appear as app icon

- [ ] **Step 6: Commit**
```bash
git add -A && git commit -m "feat: PWA manifest and service worker"
```

---

### Task 13: Deployment on Linux server

**Files:**
- Create: `ecosystem.config.js` (PM2 config)
- Create: `/etc/nginx/sites-available/dartoyna` (on server)

- [ ] **Step 1: Copy project to server**
```bash
# From local machine:
rsync -avz --exclude node_modules --exclude .git . root@YOUR_SERVER_IP:/var/www/dartoyna/
```

- [ ] **Step 2: On server — install Node.js 18 via nvm (if not already)**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
nvm alias default 18
```

Verify: `node --version` → v18.x.x or higher

- [ ] **Step 3: Install dependencies and PM2 on server**
```bash
cd /var/www/dartoyna
npm install --production
npm install -g pm2
```

- [ ] **Step 4: Create `ecosystem.config.js`**
```js
module.exports = {
  apps: [{
    name: 'dartoyna',
    script: 'server/index.js',
    env: { NODE_ENV: 'production', PORT: 3000 },
    restart_delay: 1000,
    max_restarts: 10,
  }],
};
```

- [ ] **Step 5: Start app with PM2**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow the printed command to enable auto-start on reboot
```

Verify: `pm2 status` → dartoyna app shows "online"

- [ ] **Step 6: Configure nginx**

Create `/etc/nginx/sites-available/dartoyna`:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80 default_server;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }
}
```

Enable and disable default:
```bash
ln -s /etc/nginx/sites-available/dartoyna /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

- [ ] **Step 7: (Optional but recommended) HTTPS with Let's Encrypt**
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN
```
Follow prompts. Certbot auto-renews certificates.

- [ ] **Step 8: Final smoke test**
  1. Open `http://YOUR_DOMAIN` in two mobile browsers
  2. Full game flow: create room → join → start → play → game over → share
  3. Test dark mode toggle
  4. Test "Ana ekrana ekle" on mobile

- [ ] **Step 9: Final commit**
```bash
git add ecosystem.config.js && git commit -m "chore: PM2 config for deployment"
```

---

## Done

App is live. Share the domain with friends and enjoy.
