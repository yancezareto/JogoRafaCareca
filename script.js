/**
 * Tetris Velocity Burst - script.js
 * Logic, Collisions, Physics, and Particles
 */

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const speedElement = document.getElementById('speed');
const shakeTarget = document.getElementById('shake-target');
const gameOverOverlay = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
nextCanvas.width = 100;
nextCanvas.height = 100;

// Colors matching the CSS variables
const COLORS = {
    'I': '#00f2ff',
    'J': '#0044ff',
    'L': '#ff9d00',
    'O': '#fff600',
    'S': '#00ff66',
    'T': '#ae00ff',
    'Z': '#ff0044'
};

const PIECES = {
    'I': [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    'J': [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    'L': [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    'O': [[1, 1], [1, 1]],
    'S': [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    'T': [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    'Z': [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
};

// Game State
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let linesCleared = 0;
let gameOver = false;
let currentPiece = null;
let nextPiece = null;
let dropCounter = 0;
let dropInterval = 1000; // ms
let lastTime = 0;
let particles = [];
let flashRows = [];
let shakeIntensity = 0;

class Piece {
    constructor(type) {
        this.type = type;
        this.shape = PIECES[type];
        this.color = COLORS[type];
        this.x = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
        this.y = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1;
    }
}

function randomPiece() {
    const types = Object.keys(PIECES);
    const type = types[Math.floor(Math.random() * types.length)];
    return new Piece(type);
}

function drawBlock(x, y, color, alpha = 1) {
    ctx.globalAlpha = alpha;

    // Gradient for premium look
    const grad = ctx.createLinearGradient(x * BLOCK_SIZE, y * BLOCK_SIZE, (x + 1) * BLOCK_SIZE, (y + 1) * BLOCK_SIZE);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#000');

    ctx.fillStyle = grad;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    // Stroke for grid effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    // Glow highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 4, 2);

    ctx.globalAlpha = 1;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Board
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                if (flashRows.includes(y)) {
                    drawBlock(x, y, '#fff', 1);
                } else {
                    drawBlock(x, y, value);
                }
            }
        });
    });

    // Draw Grid (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < COLS; i++) {
        ctx.beginPath(); ctx.moveTo(i * BLOCK_SIZE, 0); ctx.lineTo(i * BLOCK_SIZE, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < ROWS; i++) {
        ctx.beginPath(); ctx.moveTo(0, i * BLOCK_SIZE); ctx.lineTo(canvas.width, i * BLOCK_SIZE); ctx.stroke();
    }

    // Draw Current Piece
    if (currentPiece) {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    drawBlock(currentPiece.x + x, currentPiece.y + y, currentPiece.color);
                }
            });
        });
    }

    // Update & Draw Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw(ctx);
    });

    // Handle Shake
    if (shakeIntensity > 0) {
        const sx = (Math.random() - 0.5) * shakeIntensity;
        const sy = (Math.random() - 0.5) * shakeIntensity;
        shakeTarget.style.transform = `translate(${sx}px, ${sy}px)`;
        shakeIntensity *= 0.9;
        if (shakeIntensity < 0.5) {
            shakeIntensity = 0;
            shakeTarget.style.transform = 'translate(0, 0)';
        }
    }
}

function collide(p, b, dx = 0, dy = 0) {
    for (let y = 0; y < p.shape.length; y++) {
        for (let x = 0; x < p.shape[y].length; x++) {
            if (p.shape[y][x]) {
                const newX = p.x + x + dx;
                const newY = p.y + y + dy;
                if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && b[newY][newX])) {
                    return true;
                }
            }
        }
    }
    return false;
}

function merge(p) {
    p.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                if (p.y + y < 0) {
                    gameOver = true;
                } else {
                    board[p.y + y][p.x + x] = p.color;
                }
            }
        });
    });
}

function rotatePiece() {
    const original = currentPiece.shape;
    const rotated = original[0].map((_, i) => original.map(row => row[i]).reverse());
    const oldShape = currentPiece.shape;
    currentPiece.shape = rotated;
    if (collide(currentPiece, board)) {
        currentPiece.shape = oldShape;
    }
}

function clearLines() {
    let linesInThisClear = 0;
    const rowsToFlash = [];

    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            linesInThisClear++;
            rowsToFlash.push(y);
        }
    }

    if (linesInThisClear > 0) {
        flashRows = rowsToFlash;

        // Effects
        if (linesInThisClear === 4) {
            shakeIntensity = 15;
            score += 800;
        } else {
            score += [0, 100, 300, 500][linesInThisClear];
        }

        linesCleared += linesInThisClear;

        // Spawn particles
        rowsToFlash.forEach(y => {
            for (let x = 0; x < COLS; x++) {
                for (let i = 0; i < 3; i++) {
                    particles.push(new Particle(x * BLOCK_SIZE + 15, y * BLOCK_SIZE + 15, board[y][x]));
                }
            }
        });

        // Flash timing
        setTimeout(() => {
            flashRows = [];
            for (let y = ROWS - 1; y >= 0; y--) {
                if (board[y].every(cell => cell !== 0)) {
                    board.splice(y, 1);
                    board.unshift(Array(COLS).fill(0));
                    y++; // recheck same index
                }
            }
            updateStats();
        }, 150);
    }
}

function updateStats() {
    scoreElement.innerText = score.toString().padStart(5, '0');
    linesElement.innerText = linesCleared;

    // Exponential speed increase: Interval = Initial * (0.9)^lines
    dropInterval = Math.max(50, 1000 * Math.pow(0.9, linesCleared));
    const speedMult = (1000 / dropInterval).toFixed(1);
    speedElement.innerText = speedMult + 'x';

    drawNextPiece();
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;

    const blockSizePreview = 20;
    const offsetX = (nextCanvas.width - nextPiece.shape[0].length * blockSizePreview) / 2;
    const offsetY = (nextCanvas.height - nextPiece.shape.length * blockSizePreview) / 2;

    nextPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const px = offsetX + x * blockSizePreview;
                const py = offsetY + y * blockSizePreview;

                const grad = nextCtx.createLinearGradient(px, py, px + blockSizePreview, py + blockSizePreview);
                grad.addColorStop(0, nextPiece.color);
                grad.addColorStop(1, '#000');

                nextCtx.fillStyle = grad;
                nextCtx.fillRect(px, py, blockSizePreview, blockSizePreview);
                nextCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                nextCtx.strokeRect(px, py, blockSizePreview, blockSizePreview);
            }
        });
    });
}

function drop() {
    if (gameOver) return;

    currentPiece.y++;
    if (collide(currentPiece, board)) {
        currentPiece.y--;
        merge(currentPiece);
        clearLines();
        currentPiece = nextPiece;
        nextPiece = randomPiece();
        updateStats();
        if (collide(currentPiece, board)) {
            gameOver = true;
            showGameOver();
        }
    }
    dropCounter = 0;
}

function hardDrop() {
    while (!collide(currentPiece, board, 0, 1)) {
        currentPiece.y++;
    }
    drop();
}

function showGameOver() {
    gameOverOverlay.style.display = 'flex';
    finalScoreElement.innerText = `Final Score: ${score}`;
}

function resetGame() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    linesCleared = 0;
    gameOver = false;
    currentPiece = randomPiece();
    nextPiece = randomPiece();
    dropInterval = 1000;
    updateStats();
    gameOverOverlay.style.display = 'none';
    lastTime = performance.now();
    update();
}

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        drop();
    }

    draw();
    if (!gameOver) {
        requestAnimationFrame(update);
    }
}

window.addEventListener('keydown', event => {
    if (gameOver) return;

    if (event.code === 'ArrowLeft') {
        if (!collide(currentPiece, board, -1, 0)) currentPiece.x--;
    } else if (event.code === 'ArrowRight') {
        if (!collide(currentPiece, board, 1, 0)) currentPiece.x++;
    } else if (event.code === 'ArrowDown') {
        drop();
    } else if (event.code === 'ArrowUp') {
        rotatePiece();
    } else if (event.code === 'Space') {
        hardDrop();
    }
});

// Start
currentPiece = randomPiece();
nextPiece = randomPiece();
updateStats();
update();
