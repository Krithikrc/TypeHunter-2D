// === Typing Treasure Hunt ===============================================
// Canvas game with doors that show words/jumbles, a timer, hazards on fail,
// and a treasure at the end. Pure HTML/CSS/JS; no external assets needed.
// ========================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;  // 960
const H = canvas.height; // 540

// DOM elements
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const livesEl = document.getElementById('lives');
const timerBarEl = document.getElementById('timerBar');
const timerTextEl = document.getElementById('timerText');
const targetWordEl = document.getElementById('targetWord');
const typedWordEl = document.getElementById('typedWord');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMsg = document.getElementById('overlayMsg');
const overlayResume = document.getElementById('overlayResume');
const overlayRestart = document.getElementById('overlayRestart');
const btnPause = document.getElementById('btnPause');
const btnResume = document.getElementById('btnResume');
const btnRestart = document.getElementById('btnRestart');

// Game state
const state = {
  level: 1,
  maxLevel: 7,
  score: 0,
  streak: 0,
  lives: 3,
  paused: false,
  over: false,
  won: false,
  // typing
  target: '',
  typed: '',
  // timers
  roundTime: 10.0, // seconds (will shrink on higher levels)
  timeLeft: 10.0,
  // animations
  t: 0,
  // entities
  player: { x: 80, y: H - 140, w: 36, h: 52, vx: 0, speed: 3.2 },
  door: { x: 560, y: H - 200, w: 80, h: 140, open: 0 }, // open: 0..1
  hazard: null, // { type: 'fire'|'arrow', x,y,w,h,vx,active }
  // camera shake
  shakeT: 0,
};

// Words & jumbles
const WORDS = [
  "brave", "shield", "mystic", "ember", "dragon", "vault", "sapphire",
  "quest", "shadow", "riddle", "cipher", "eclipse", "onyx", "phoenix",
  "valor", "glyph", "artifact", "runic", "emberfall", "starforge",
];

function jumble(str) {
  // Return either the word, a partial group, or a scrambled variant
  const r = Math.random();
  const arr = str.split('');
  if (r < 0.33) {
    // scrambled
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  } else if (r < 0.66) {
    // grouped letters (non-grammatical chunking)
    const chunks = [];
    let i = 0;
    while (i < arr.length) {
      const len = Math.min(arr.length - i, 1 + (Math.random() * 3 | 0));
      chunks.push(arr.slice(i, i + len).join(''));
      i += len;
    }
    return chunks.join(' ');
  } else {
    // original word
    return str;
  }
}

function randomTarget(level) {
  const base = WORDS[(Math.random() * WORDS.length) | 0];
  // Slightly longer words on higher levels
  const mix = (level >= 5) ? base + ((Math.random() < 0.5) ? base[0] : "") : base;
  return jumble(mix);
}

// Lives UI
function drawLives() {
  livesEl.innerHTML = '';
  for (let i = 0; i < state.lives; i++) {
    const div = document.createElement('div');
    div.className = 'heart';
    livesEl.appendChild(div);
  }
}

// Setup a new room/round
function newRound(resetTimer = true) {
  state.typed = '';
  state.target = randomTarget(state.level);
  targetWordEl.textContent = state.target;
  typedWordEl.textContent = '';
  if (resetTimer) {
    const base = 10.0;
    state.roundTime = Math.max(5.0, base - (state.level - 1) * 0.8);
    state.timeLeft = state.roundTime;
  }
  state.door.open = 0;
  state.player.x = 80;
  state.hazard = null;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Input handling
window.addEventListener('keydown', (e) => {
  if (state.over || state.paused) return;

  if (e.key === 'Backspace') {
    state.typed = state.typed.slice(0, -1);
    updateTypedUI();
    return;
  }
  if (e.key.length === 1) {
    // accept visible chars only
    state.typed += e.key;
    updateTypedUI();
    checkTyped();
  }
});

function updateTypedUI() {
  // color correct prefix green, error red at mismatch
  const t = state.typed;
  const target = state.target;
  let html = '';
  let mismatch = false;
  for (let i = 0; i < t.length; i++) {
    const ok = t[i] === target[i];
    if (!ok) mismatch = true;
    html += `<span style="color:${ok ? '#53ffa1' : '#ff5d73'}">${t[i]}</span>`;
  }
  const rest = target.slice(t.length).replace(/ /g, '&nbsp;');
  typedWordEl.innerHTML = html + `<span style="color:${mismatch ? '#ff5d73' : '#9aa3b2'}">${rest}</span>`;
}

function checkTyped() {
  // If full match (exact including spaces), success
  if (state.typed === state.target) {
    onSuccess();
  }
}

// Success: open door, walk in, level up
function onSuccess() {
  // Scoring: faster = more points; streak bonus
  const timeRatio = clamp(state.timeLeft / state.roundTime, 0, 1);
  const base = 100 + Math.round(100 * timeRatio);
  state.streak += 1;
  state.score += base + state.streak * 10;
  // Animate door opening
  state.door.open = 1; // 0..1, we’ll render as open
  // Move player forward automatically
  state.player.vx = state.player.speed * 1.2;

  // After crossing door, proceed next level
  setTimeout(() => {
    state.player.vx = 0;
    if (state.level < state.maxLevel) {
      state.level += 1;
      levelEl.textContent = state.level;
      streakEl.textContent = state.streak;
      scoreEl.textContent = state.score.toLocaleString('en-IN');
      newRound(true);
    } else {
      // Win!
      state.won = true;
      state.over = true;
      showOverlay("🎉 Treasure Found!", `You cleared all rooms with a score of ${state.score.toLocaleString('en-IN')} and a streak of ${state.streak}.`);
    }
  }, 1000);
}

// Failure: spawn hazard, lose life, reset round
function onFail() {
  if (state.hazard) return; // already failing
  // Random hazard: fireball or arrow
  const useFire = Math.random() < 0.6;
  if (useFire) {
    state.hazard = { type: 'fire', x: W + 40, y: state.player.y + 10, w: 28, h: 28, vx: -6.0, active: true };
  } else {
    state.hazard = { type: 'arrow', x: W + 40, y: state.player.y + 18, w: 40, h: 6, vx: -8.0, active: true };
  }

  // After a moment, if it collides → lose life and reset
  setTimeout(() => {
    if (!state.hazard) return;
    if (rectsOverlap(playerRect(), hazardRect())) {
      cameraShake(12);
    }
    state.lives -= 1;
    drawLives();
    if (state.lives <= 0) {
      state.over = true;
      showOverlay("☠ Game Over", `Final Score: ${state.score.toLocaleString('en-IN')}. Press Restart to try again.`);
      return;
    }
    // Reset round (different target)
    state.streak = 0;
    streakEl.textContent = state.streak;
    newRound(true);
  }, 800);
}

// Rect helpers
function playerRect() { const p = state.player; return { x: p.x, y: p.y, w: p.w, h: p.h }; }
function hazardRect() { const h = state.hazard; return { x: h.x, y: h.y, w: h.w, h: h.h }; }
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Camera shake
function cameraShake(frames = 10) { state.shakeT = frames; }

// Pause/Resume/Restart
btnPause.addEventListener('click', () => {
  if (state.over) return;
  state.paused = true;
  showOverlay("Paused", "Take a short break.");
});
btnResume.addEventListener('click', () => hideOverlay());
btnRestart.addEventListener('click', restart);
overlayResume.addEventListener('click', () => hideOverlay());
overlayRestart.addEventListener('click', restart);

function showOverlay(title, msg) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlay.classList.remove('hidden');
  state.paused = true;
}
function hideOverlay() {
  overlay.classList.add('hidden');
  if (!state.over) state.paused = false;
}
function restart() {
  overlay.classList.add('hidden');
  Object.assign(state, {
    ...state,
    level: 1, score: 0, streak: 0, lives: 3,
    paused: false, over: false, won: false
  });
  levelEl.textContent = state.level;
  scoreEl.textContent = state.score;
  streakEl.textContent = state.streak;
  drawLives();
  newRound(true);
}

// Timer tick
function tickTimer(dt) {
  state.timeLeft -= dt;
  if (state.timeLeft <= 0 && !state.over && !state.paused) {
    state.timeLeft = 0;
    // Trigger failure once per round
    if (!state.hazard) onFail();
  }
  // Update UI
  const ratio = clamp(state.timeLeft / state.roundTime, 0, 1);
  timerBarEl.style.width = `${ratio * 100}%`;
  timerTextEl.textContent = `${state.timeLeft.toFixed(1)}s`;
  scoreEl.textContent = state.score.toLocaleString('en-IN');
  streakEl.textContent = state.streak;
}

// ===== Rendering =========================================================
function drawBackground() {
  // Dungeon gradient sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0f1330');
  g.addColorStop(0.6, '#111633');
  g.addColorStop(1, '#0c1026');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Far columns / bricks (simple parallax)
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < W; i += 52) {
    ctx.fillStyle = '#a4b1ff';
    ctx.fillRect(i, 80, 36, H - 240);
  }
  ctx.globalAlpha = 1;

  // Floor tiles
  for (let x = 0; x < W; x += 40) {
    ctx.fillStyle = (x / 40) % 2 ? '#1b2147' : '#1a1f40';
    ctx.fillRect(x, H - 80, 40, 80);
  }
  // Top floor glossy line
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, H - 80, W, 2);
}

function drawDoor() {
  const d = state.door;
  const open = d.open; // 0..1
  // Door frame
  ctx.fillStyle = '#2b2f55';
  ctx.fillRect(d.x - 8, d.y - 8, d.w + 16, d.h + 16);
  // Door leafs open outwards horizontally
  const leafW = (d.w / 2) * (1 - open);
  ctx.fillStyle = '#5a628c';
  ctx.fillRect(d.x, d.y, leafW, d.h);
  ctx.fillRect(d.x + d.w - leafW, d.y, leafW, d.h);

  // Decorative bars
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 5; i++) {
    const yy = d.y + 10 + i * (d.h - 20) / 4;
    ctx.fillRect(d.x + 6, yy, d.w - 12, 2);
  }

  // Target text on the door (only if not fully open)
  if (open < 0.99) {
    ctx.font = 'bold 22px ui-sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e9ecf1';
    ctx.fillText(state.target, d.x + d.w / 2, d.y + d.h / 2);
  }
}

function drawPlayer() {
  const p = state.player;
  // Body
  const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  grad.addColorStop(0, '#8fd7ff');
  grad.addColorStop(1, '#59b6ff');
  ctx.fillStyle = grad;
  ctx.fillRect(p.x, p.y, p.w, p.h);

  // Head
  ctx.fillStyle = '#f5faff';
  ctx.fillRect(p.x + 8, p.y - 18, 20, 18);

  // Eyes
  ctx.fillStyle = '#111325';
  ctx.fillRect(p.x + 12, p.y - 11, 4, 4);
  ctx.fillRect(p.x + 20, p.y - 11, 4, 4);

  // Shield (left)
  ctx.fillStyle = '#6efacc';
  ctx.fillRect(p.x - 10, p.y + 10, 8, 24);

  // Sword (right)
  ctx.fillStyle = '#ffd27a';
  ctx.fillRect(p.x + p.w + 2, p.y + 10, 10, 22);
  ctx.fillStyle = '#ffe9b6';
  ctx.fillRect(p.x + p.w + 4, p.y, 6, 10);
}

function drawHazard() {
  const h = state.hazard;
  if (!h) return;

  if (h.type === 'fire') {
    // Fireball: core and flame
    const grad = ctx.createRadialGradient(h.x + 14, h.y + 14, 4, h.x + 14, h.y + 14, 18);
    grad.addColorStop(0, '#fff1b8');
    grad.addColorStop(0.4, '#ffb34d');
    grad.addColorStop(1, '#ff5d73');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(h.x + 14, h.y + 14, 14, 0, Math.PI * 2);
    ctx.fill();

    // Trail
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ff7a9b';
    ctx.fillRect(h.x + 20, h.y + 8, 28, 12);
    ctx.globalAlpha = 1;
  } else if (h.type === 'arrow') {
    // Shaft
    ctx.fillStyle = '#c9d1e6';
    ctx.fillRect(h.x, h.y, h.w, h.h);
    // Tip
    ctx.fillStyle = '#e6eefc';
    ctx.beginPath();
    ctx.moveTo(h.x, h.y - 6);
    ctx.lineTo(h.x, h.y + h.h + 6);
    ctx.lineTo(h.x - 12, h.y + h.h / 2);
    ctx.closePath();
    ctx.fill();
    // Fletching
    ctx.fillStyle = '#a3b3e6';
    ctx.fillRect(h.x + h.w - 4, h.y - 6, 3, h.h + 12);
  }
}

function drawTreasure() {
  // Final treasure chest
  const x = W - 200, y = H - 160, w = 120, h = 70;
  ctx.fillStyle = '#9b6b2c';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#b8853a';
  ctx.fillRect(x, y, w, 18);
  ctx.fillStyle = '#ffd27a';
  ctx.fillRect(x + w / 2 - 6, y + 24, 12, 22);

  // Glow
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fffdbb';
  ctx.fillRect(x - 12, y - 30, w + 24, 18);
  ctx.globalAlpha = 1;
}

// ===== Main Loop =========================================================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); // cap delta
  last = now;

  if (!state.paused && !state.over) {
    update(dt);
  }
  render();

  requestAnimationFrame(loop);
}

function update(dt) {
  state.t += dt;

  // Door opening animation dampening (if success triggered)
  if (state.door.open > 0) {
    state.door.open = clamp(state.door.open + dt * 1.2, 0, 1);
  }

  // Timer
  tickTimer(dt);

  // Move player forward only while door opening success sequence
  if (state.player.vx !== 0) {
    state.player.x += state.player.vx;
    if (state.player.x > state.door.x + state.door.w + 20) {
      state.player.vx = 0;
    }
  }

  // Hazard movement & collision
  if (state.hazard) {
    state.hazard.x += state.hazard.vx;
    if (rectsOverlap(playerRect(), hazardRect())) {
      // impact
      state.hazard = null;
      cameraShake(10);
    } else if (state.hazard.x < -60) {
      state.hazard = null;
    }
  }

  if (state.shakeT > 0) state.shakeT--;
}

function render() {
  // camera shake
  const ox = (state.shakeT > 0) ? (Math.random() * 6 - 3) : 0;
  const oy = (state.shakeT > 0) ? (Math.random() * 4 - 2) : 0;
  ctx.save();
  ctx.translate(ox, oy);

  drawBackground();

  // if last level, show treasure behind door
  if (state.level === state.maxLevel) drawTreasure();

  drawDoor();
  drawPlayer();
  drawHazard();

  // Ground shadow under player
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  const p = state.player;
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, H - 86, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ===== Init ==============================================================
function init() {
  drawLives();
  levelEl.textContent = state.level;
  scoreEl.textContent = state.score;
  streakEl.textContent = state.streak;
  newRound(true);
  requestAnimationFrame(loop);
}
init();

// ===== Utility: prevent page scroll on space etc. =======================
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
}, { passive: false });

// ===== Keyboard Shortcuts ===============================================
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !state.over) {
    state.paused ? hideOverlay() : showOverlay("Paused", "Press Resume to continue.");
  }
});

// ===== Responsive Typing Panel Focus ====================================
// (No input element; we capture keys globally. Just ensure the user knows.)
// ========================================================================
