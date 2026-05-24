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

describe('GameStore.submitScore', () => {
  let store, roomCode;
  beforeEach(() => {
    store = new GameStore();
    ({ roomCode } = store.createRoom('Ali', 'socket-1'));
    store.joinRoom(roomCode, 'Veli', 'socket-2');
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
    store.rooms.get(roomCode).players[0].legsWon = 1;
    store.rooms.get(roomCode).players[0].score = 60;
    const { gameOver } = store.submitScore(roomCode, 'socket-1', 60);
    expect(gameOver).toBe(true);
  });

  test('bust: score leaving exactly 1 remaining is a bust', () => {
    store.rooms.get(roomCode).players[0].score = 121;
    const { bust } = store.submitScore(roomCode, 'socket-1', 120);
    expect(bust).toBe(true);
    expect(store.rooms.get(roomCode).players[0].score).toBe(121);
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
    store.rooms.get(roomCode).currentPlayerIndex = 0;
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
    store.joinRoom(roomCode, 'Ali', 'socket-1b');
    expect(store.disconnectTimers.has('socket-1')).toBe(false);
  });
});
