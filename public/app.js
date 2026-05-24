if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const socket = io();
let myName = '';
let myRoomCode = '';
let isHost = false;
let lastGameOver = null;

// ── View switching ─────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Dark mode ──────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const html = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  html.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
  updateThemeIcon();

  document.getElementById('btn-theme').addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon();
  });

  function updateThemeIcon() {
    document.getElementById('btn-theme').textContent =
      html.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
  }
})();

// ── Home view ──────────────────────────────────────────────────
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
  if (!/^\d{4}$/.test(code)) return showError('home-error', '4 haneli oda kodunu gir');
  myName = name;
  myRoomCode = code;
  socket.emit('join-room', { roomCode: code, playerName: name });
});

document.getElementById('home-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});
document.getElementById('home-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-create').click();
});

// ── Lobby view ─────────────────────────────────────────────────
document.getElementById('lobby-code').addEventListener('click', () => {
  navigator.clipboard.writeText(myRoomCode).catch(() => {});
});

document.getElementById('btn-start').addEventListener('click', () => {
  const mode = parseInt(document.getElementById('setting-mode').value);
  const legsToWin = parseInt(document.getElementById('setting-format').value);
  socket.emit('start-game', { mode, legsToWin });
});

// ── Training mode ─────────────────────────────────────────────
const TRAINING_TARGETS = [
  ...Array.from({ length: 20 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 20 }, (_, i) => `D${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `T${i + 1}`),
  'Bull', 'D-Bull',
];

let trainingHits = 0;
let trainingTotal = 0;
let trainingStreak = 0;

function randomTarget() {
  return TRAINING_TARGETS[Math.floor(Math.random() * TRAINING_TARGETS.length)];
}

function nextTrainingTarget() {
  document.getElementById('training-target').textContent = randomTarget();
}

function updateTrainingStats() {
  const pct = trainingTotal === 0 ? 0 : Math.round(trainingHits / trainingTotal * 100);
  document.getElementById('training-streak').textContent = `🔥 ${trainingStreak}`;
  document.getElementById('training-stats').innerHTML = `
    <div class="stat-item"><div class="stat-val">${trainingHits}</div><div class="stat-key">İsabet</div></div>
    <div class="stat-item"><div class="stat-val">${trainingTotal - trainingHits}</div><div class="stat-key">Kaçırma</div></div>
    <div class="stat-item"><div class="stat-val">${pct}%</div><div class="stat-key">Başarı</div></div>
  `;
}

document.getElementById('btn-training').addEventListener('click', () => {
  trainingHits = 0; trainingTotal = 0; trainingStreak = 0;
  nextTrainingTarget();
  updateTrainingStats();
  showView('view-training');
});

document.getElementById('btn-training-back').addEventListener('click', () => showView('view-home'));

document.getElementById('btn-hit').addEventListener('click', () => {
  trainingHits++;
  trainingTotal++;
  trainingStreak++;
  updateTrainingStats();
  nextTrainingTarget();
});

document.getElementById('btn-miss').addEventListener('click', () => {
  trainingTotal++;
  trainingStreak = 0;
  updateTrainingStats();
  nextTrainingTarget();
});

// ── Numpad ─────────────────────────────────────────────────────
let numpadValue = '';
let numpadEnabled = false;

document.getElementById('numpad').addEventListener('click', e => {
  const btn = e.target.closest('.num-btn');
  if (!btn || !numpadEnabled) return;
  const val = btn.dataset.val;

  if (val === 'del') {
    numpadValue = numpadValue.slice(0, -1);
  } else if (val === 'ok') {
    submitScore();
    return;
  } else {
    const next = numpadValue + val;
    if (parseInt(next) > 180) return;
    numpadValue = next === '0' ? '' : next;
  }

  document.getElementById('numpad-display').textContent = numpadValue || '0';
});

document.addEventListener('keydown', e => {
  if (!numpadEnabled) return;
  if (e.key >= '0' && e.key <= '9') {
    const next = numpadValue + e.key;
    if (parseInt(next) > 180) return;
    numpadValue = next === '0' ? '' : next;
    document.getElementById('numpad-display').textContent = numpadValue || '0';
  } else if (e.key === 'Backspace') {
    numpadValue = numpadValue.slice(0, -1);
    document.getElementById('numpad-display').textContent = numpadValue || '0';
  } else if (e.key === 'Enter') {
    submitScore();
  }
});

function submitScore() {
  const val = parseInt(numpadValue) || 0;
  if (val < 0 || val > 180) return;
  socket.emit('submit-score', { score: val });
  numpadValue = '';
  document.getElementById('numpad-display').textContent = '0';
}

function setNumpadEnabled(enabled) {
  numpadEnabled = enabled;
  document.querySelectorAll('.num-btn').forEach(b => b.disabled = !enabled);
  const display = document.getElementById('numpad-display');
  if (enabled) display.classList.remove('disabled');
  else display.classList.add('disabled');
}

// ── Game over view ─────────────────────────────────────────────
document.getElementById('btn-new-game').addEventListener('click', () => {
  myRoomCode = '';
  isHost = false;
  lastGameOver = null;
  document.getElementById('home-name').value = '';
  document.getElementById('home-code').value = '';
  showView('view-home');
});

document.getElementById('btn-share').addEventListener('click', () => {
  if (!lastGameOver) return;
  const { winner, players } = lastGameOver;
  const lines = players.map(p => `${p.name}: ${p.legsWon} leg, ort ${p.avg}`).join('\n');
  const text = `🎯 Dartoyna Sonucu\n${winner} kazandı!\n\n${lines}`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => alert('Sonuç kopyalandı!')).catch(() => {});
  }
});

// ── Socket events ──────────────────────────────────────────────
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
  lastGameOver = data;
  renderGameOver(data);
  showView('view-gameover');
});

socket.on('bust', ({ playerName }) => {
  const bustEl = document.getElementById('bust-msg');
  bustEl.textContent = `${playerName} BUST!`;
  bustEl.classList.remove('hidden');
  setTimeout(() => bustEl.classList.add('hidden'), 2000);
});

socket.on('error', ({ message }) => {
  const active = document.querySelector('.view.active');
  const errEl = active && active.querySelector('.error');
  if (errEl) {
    showError(errEl.id, message);
  } else {
    alert(message);
  }
});

// ── Render functions ───────────────────────────────────────────
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

  const row = document.getElementById('game-players');
  row.innerHTML = state.players.map((p, i) => `
    <div class="player-card ${i === state.currentPlayerIndex ? 'active' : ''}">
      <div class="p-name">${esc(p.name)}</div>
      <div class="p-score">${p.score}</div>
      <div class="p-legs">${'●'.repeat(p.legsWon)}${'○'.repeat(Math.max(0, state.settings.legsToWin - p.legsWon))}</div>
    </div>
  `).join('');

  document.getElementById('turn-label').textContent =
    isMeTurn ? 'Senin sıran!' : `${currentPlayer ? currentPlayer.name : ''} atıyor...`;

  const score = currentPlayer ? currentPlayer.score : 0;
  const checkout = window.CHECKOUTS && window.CHECKOUTS[score];
  const hintEl = document.getElementById('checkout-hint');
  hintEl.textContent = checkout ? `Finish: ${checkout}` : '';

  numpadValue = '';
  document.getElementById('numpad-display').textContent = '0';
  setNumpadEnabled(isMeTurn);

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

// ── Helpers ────────────────────────────────────────────────────
function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
