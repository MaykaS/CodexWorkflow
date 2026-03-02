const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const TETROMINOES = {
  I: {
    color: "#45d9ff",
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    color: "#ffd447",
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "#c77dff",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  S: {
    color: "#5ef38c",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  Z: {
    color: "#ff6676",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  J: {
    color: "#5b8cff",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: "#ff9f43",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
};

const PIECE_KEYS = Object.keys(TETROMINOES);

const canvas = document.getElementById("game-board");
const context = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const stateLabel = document.getElementById("state-label");
const overlay = document.getElementById("overlay");
const overlayStatus = document.getElementById("overlay-status");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-btn");
const restartButton = document.getElementById("restart-btn");

let board = createBoard();
let currentPiece = null;
let score = 0;
let linesCleared = 0;
let dropInterval = 1000;
let dropCounter = 0;
let lastTime = 0;
let animationFrameId = null;
let isRunning = false;
let isPaused = false;
let isGameOver = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, columnIndex) =>
    matrix.map((row) => row[columnIndex]).reverse()
  );
}

function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  const definition = TETROMINOES[key];

  return {
    key,
    matrix: cloneMatrix(definition.shape),
    color: definition.color,
    x: Math.floor((COLS - definition.shape[0].length) / 2),
    y: 0,
  };
}

function isValidPosition(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) {
        continue;
      }

      const nextX = piece.x + x + offsetX;
      const nextY = piece.y + y + offsetY;

      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
        return false;
      }

      if (nextY >= 0 && board[nextY][nextX]) {
        return false;
      }
    }
  }

  return true;
}

function spawnPiece() {
  currentPiece = randomPiece();

  if (!isValidPosition(currentPiece)) {
    endGame();
  }
}

function mergePiece() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      const boardY = currentPiece.y + y;
      const boardX = currentPiece.x + x;

      if (boardY >= 0) {
        board[boardY][boardX] = currentPiece.color;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    score += SCORE_TABLE[cleared] || 0;
    linesCleared += cleared;
    dropInterval = Math.max(150, 1000 - linesCleared * 25);
    updateScore();
  }
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnPiece();
}

function movePiece(offsetX, offsetY) {
  if (!currentPiece || !isRunning || isPaused || isGameOver) {
    return false;
  }

  if (!isValidPosition(currentPiece, offsetX, offsetY)) {
    if (offsetY === 1) {
      lockPiece();
    }
    return false;
  }

  currentPiece.x += offsetX;
  currentPiece.y += offsetY;
  return true;
}

function rotatePiece() {
  if (!currentPiece || !isRunning || isPaused || isGameOver) {
    return;
  }

  const rotated = rotateMatrix(currentPiece.matrix);
  const kicks = [0, -1, 1, -2, 2];

  for (const offsetX of kicks) {
    if (isValidPosition(currentPiece, offsetX, 0, rotated)) {
      currentPiece.matrix = rotated;
      currentPiece.x += offsetX;
      return;
    }
  }
}

function hardDrop() {
  if (!currentPiece || !isRunning || isPaused || isGameOver) {
    return;
  }

  while (isValidPosition(currentPiece, 0, 1)) {
    currentPiece.y += 1;
  }

  lockPiece();
}

function drawCell(x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.lineWidth = 2;
  context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  context.fillStyle = "rgba(255, 255, 255, 0.12)";
  context.fillRect(x * BLOCK_SIZE + 4, y * BLOCK_SIZE + 4, BLOCK_SIZE - 8, 6);
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(x, y, value);
      }
    });
  });

  if (!currentPiece) {
    return;
  }

  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      const drawY = currentPiece.y + y;
      if (drawY >= 0) {
        drawCell(currentPiece.x + x, drawY, currentPiece.color);
      }
    });
  });
}

function updateScore() {
  scoreElement.textContent = String(score);
}

function setOverlay(visible, title = "", message = "") {
  overlay.classList.toggle("visible", visible);
  overlayStatus.textContent = title;
  overlayMessage.textContent = message;
}

function updateStateLabel() {
  if (isGameOver) {
    stateLabel.textContent = "Game Over";
    return;
  }

  if (isPaused) {
    stateLabel.textContent = "Paused";
    return;
  }

  stateLabel.textContent = isRunning ? "Running" : "Idle";
}

function resetGame() {
  board = createBoard();
  currentPiece = null;
  score = 0;
  linesCleared = 0;
  dropInterval = 1000;
  dropCounter = 0;
  lastTime = 0;
  isPaused = false;
  isGameOver = false;
  updateScore();
}

function startGame() {
  cancelAnimationFrame(animationFrameId);
  resetGame();
  isRunning = true;
  spawnPiece();

  if (isGameOver) {
    return;
  }

  updateStateLabel();
  setOverlay(false);
  drawBoard();
  animationFrameId = requestAnimationFrame(update);
}

function endGame() {
  isRunning = false;
  isPaused = false;
  isGameOver = true;
  updateStateLabel();
  setOverlay(true, "Game Over", "A new piece could not spawn. Press Restart to try again.");
  cancelAnimationFrame(animationFrameId);
  drawBoard();
}

function togglePause() {
  if (!isRunning || isGameOver) {
    return;
  }

  isPaused = !isPaused;
  dropCounter = 0;
  lastTime = 0;
  updateStateLabel();

  if (isPaused) {
    setOverlay(true, "Paused", "Press P to resume the game.");
    cancelAnimationFrame(animationFrameId);
    drawBoard();
    return;
  }

  setOverlay(false);
  animationFrameId = requestAnimationFrame(update);
}

function update(time = 0) {
  if (!isRunning || isPaused || isGameOver) {
    return;
  }

  const deltaTime = lastTime ? time - lastTime : 0;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter >= dropInterval) {
    movePiece(0, 1);
    dropCounter = 0;
  }

  drawBoard();

  if (isRunning && !isPaused && !isGameOver) {
    animationFrameId = requestAnimationFrame(update);
  }
}

function handleKeydown(event) {
  const key = event.code;

  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space", "KeyP"].includes(key)) {
    event.preventDefault();
  }

  if (key === "KeyP") {
    togglePause();
    return;
  }

  if (!isRunning || isPaused || isGameOver) {
    return;
  }

  switch (key) {
    case "ArrowLeft":
      movePiece(-1, 0);
      break;
    case "ArrowRight":
      movePiece(1, 0);
      break;
    case "ArrowDown":
      movePiece(0, 1);
      dropCounter = 0;
      break;
    case "ArrowUp":
      rotatePiece();
      break;
    case "Space":
      hardDrop();
      dropCounter = 0;
      break;
    default:
      return;
  }

  drawBoard();
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
document.addEventListener("keydown", handleKeydown);

updateScore();
updateStateLabel();
setOverlay(true, "Press Start", "Stack blocks, clear rows, and survive the speed-up.");
drawBoard();
