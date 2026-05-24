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

  submitScore(roomCode, socketId, score) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'playing') return { error: 'Oyun yok' };

    const player = room.players[room.currentPlayerIndex];
    if (player.id !== socketId) return { error: 'Sıra sende değil' };
    if (typeof score !== 'number' || score < 0 || score > 180) return { error: 'Geçersiz skor (0-180)' };

    room.lastActivityAt = Date.now();
    player.turns.push(score);

    const remaining = player.score - score;

    if (remaining < 0 || remaining === 1) {
      this._advanceTurn(room);
      return { room, bust: true };
    }

    player.score = remaining;

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
    // The player after the winner starts the next leg (loser in 2-player games)
    const winnerIdx = room.currentPlayerIndex;
    room.firstPlayerThisLeg = (winnerIdx + 1) % room.players.length;
    room.currentPlayerIndex = room.firstPlayerThisLeg;
    room.players.forEach(p => { p.score = room.settings.mode; });
  }

  handleDisconnect(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return;

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(socketId);
      const room = this.rooms.get(roomCode);
      if (!room) return;

      this.socketToRoom.delete(socketId);
      const activeCount = room.players.filter(p => this.socketToRoom.has(p.id)).length;

      if (activeCount === 0) {
        this.rooms.delete(roomCode);
        return;
      }

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
        const finishedAge = room.status === 'finished' ? age : 0;
        if (age > 60 * 60 * 1000 || finishedAge > 5 * 60 * 1000) {
          this.rooms.delete(code);
        }
      }
    }, 5 * 60 * 1000);
  }
}

module.exports = GameStore;
