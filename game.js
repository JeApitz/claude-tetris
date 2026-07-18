'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Nut - gris metálico
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca) - anillo con hueco central
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SKIN_COLORS = {
  retro: COLORS,
  neon: [
    null,
    '#00e5ff', // I
    '#fff700', // O
    '#e040fb', // T
    '#39ff14', // S
    '#ff1744', // Z
    '#00b0ff', // J
    '#ff9100', // L
    '#e0e0e0', // Nut
  ],
  pastel: [
    null,
    '#a8e6f0', // I
    '#fff3b0', // O
    '#dcb8e8', // T
    '#bfe6c0', // S
    '#f4b8b8', // Z
    '#b8d4f0', // J
    '#f7d3a8', // L
    '#dcdde0', // Nut
  ],
  pixel: COLORS,
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const skinSelect = document.getElementById('skin-select');
const comboMsg = document.getElementById('combo-msg');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, lastClearWasLine, comboMsgTimeout;
let currentSkin = 'retro';

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    const base = (LINE_SCORES[cleared] || 0) * level;
    if (lastClearWasLine) {
      score += base * 2;
      showComboMessage();
    } else {
      score += base;
    }
    lastClearWasLine = true;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    lastClearWasLine = false;
  }
}

function showComboMessage() {
  comboMsg.textContent = '¡PUNTUACIÓN x2!';
  comboMsg.classList.remove('hidden');
  comboMsg.classList.remove('combo-msg-anim');
  void comboMsg.offsetWidth; // forzar reflow para reiniciar la animación
  comboMsg.classList.add('combo-msg-anim');
  clearTimeout(comboMsgTimeout);
  comboMsgTimeout = setTimeout(() => {
    comboMsg.classList.add('hidden');
  }, 1200);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function themeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function drawRetroBlock(context, px, py, size, color) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = themeColor('--block-highlight');
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawNeonBlock(context, px, py, size, color) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = size * 0.4;
  context.fillStyle = '#0a0a0f';
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 2, py + 2, size - 4, size - 4);
  context.restore();
}

function drawPastelBlock(context, px, py, size, color) {
  const r = Math.min(6, size / 4);
  const x = px + 1;
  const y = py + 1;
  const w = size - 2;
  const h = size - 2;
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  // soft highlight dot
  context.fillStyle = 'rgba(255, 255, 255, 0.4)';
  context.beginPath();
  context.arc(x + w * 0.3, y + h * 0.3, size * 0.12, 0, Math.PI * 2);
  context.fill();
}

function drawPixelBlock(context, px, py, size, color) {
  const x = px + 1;
  const y = py + 1;
  const w = size - 2;
  const h = size - 2;
  context.fillStyle = color;
  context.fillRect(x, y, w, h);
  // checkerboard texture overlay
  const cell = Math.max(2, Math.floor(size / 6));
  context.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let ty = 0; ty < h; ty += cell) {
    for (let tx = 0; tx < w; tx += cell) {
      if (((tx / cell) + (ty / cell)) % 2 === 0) {
        context.fillRect(x + tx, y + ty, Math.min(cell, w - tx), Math.min(cell, h - ty));
      }
    }
  }
  context.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const palette = SKIN_COLORS[currentSkin] || COLORS;
  const color = palette[colorIndex] || COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  const px = x * size;
  const py = y * size;
  switch (currentSkin) {
    case 'neon':
      drawNeonBlock(context, px, py, size, color);
      break;
    case 'pastel':
      drawPastelBlock(context, px, py, size, color);
      break;
    case 'pixel':
      drawPixelBlock(context, px, py, size, color);
      break;
    default:
      drawRetroBlock(context, px, py, size, color);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = themeColor('--grid-line');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  const ghostAlpha = parseFloat(themeColor('--ghost-alpha')) || 0.2;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver || paused) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeSwitch.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
  if (current) draw();
  if (next) drawNext();
}

themeSwitch.addEventListener('change', () => {
  applyTheme(themeSwitch.checked ? 'light' : 'dark');
});

applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');

function applySkin(skin) {
  currentSkin = SKIN_COLORS[skin] ? skin : 'retro';
  skinSelect.value = currentSkin;
  canvas.classList.toggle('skin-neon-glow', currentSkin === 'neon');
  nextCanvas.classList.toggle('skin-neon-glow', currentSkin === 'neon');
  localStorage.setItem(SKIN_KEY, currentSkin);
  if (current) draw();
  if (next) drawNext();
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
});

applySkin(localStorage.getItem(SKIN_KEY) || 'retro');

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastClearWasLine = false;
  clearTimeout(comboMsgTimeout);
  comboMsg.classList.add('hidden');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
