const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------- Game state ----------
const state = {
  score: 0,
  lives: 3,
  paused: false,
  started: false,
  gameOver: false,
};

// Paddle
const paddle = {
  w: 110,
  h: 14,
  x: (canvas.width - 110) / 2,
  y: canvas.height - 30,
  speed: 7,
  dx: 0,
};

// Ball
const ball = {
  r: 7,
  x: canvas.width / 2,
  y: paddle.y - 7 - 1,
  vx: 0,
  vy: 0,
  speed: 5,
};

// Bricks
const bricks = {
  rows: 7,
  cols: 8,
  w: 48,
  h: 18,
  pad: 10,
  top: 70,
  left: 22,
  grid: [],
};

function resetBricks() {
  bricks.grid = [];
  for (let r = 0; r < bricks.rows; r++) {
    bricks.grid[r] = [];
    for (let c = 0; c < bricks.cols; c++) {
      bricks.grid[r][c] = { alive: true };
    }
  }
}

function resetBallOnPaddle() {
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r - 1;
  ball.vx = 0;
  ball.vy = 0;
  state.started = false;
}

function fullReset() {
  state.score = 0;
  state.lives = 3;
  state.paused = false;
  state.started = false;
  state.gameOver = false;
  paddle.x = (canvas.width - paddle.w) / 2;
  paddle.dx = 0;
  resetBricks();
  resetBallOnPaddle();
}

resetBricks();
resetBallOnPaddle();

// ---------- Input ----------
const keys = new Set();

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === " " || e.code === "Space") {
    if (state.gameOver) return;
    if (!state.started) launchBall();
    else state.paused = !state.paused;
    e.preventDefault();
  }

  if (k === "r") fullReset();
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

function launchBall() {
  state.started = true;
  // Random-ish angle upward
  const angle = (Math.random() * 0.9 + 0.15) * Math.PI; // ~[0.15π, 1.05π]
  ball.vx = Math.cos(angle) * ball.speed;
  ball.vy = -Math.abs(Math.sin(angle) * ball.speed);
}

// ---------- Helpers ----------
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= r * r;
}

function remainingBricks() {
  let count = 0;
  for (let r = 0; r < bricks.rows; r++) {
    for (let c = 0; c < bricks.cols; c++) {
      if (bricks.grid[r][c].alive) count++;
    }
  }
  return count;
}

// ---------- Update ----------
function update() {
  // Paddle movement
  const left = keys.has("arrowleft") || keys.has("a");
  const right = keys.has("arrowright") || keys.has("d");
  paddle.dx = (right ? 1 : 0) - (left ? 1 : 0);

  paddle.x += paddle.dx * paddle.speed;
  paddle.x = clamp(paddle.x, 0, canvas.width - paddle.w);

  // If ball not launched, keep it on paddle
  if (!state.started) {
    resetBallOnPaddle();
    return;
  }

  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall collisions
  if (ball.x - ball.r <= 0) {
    ball.x = ball.r;
    ball.vx *= -1;
  }
  if (ball.x + ball.r >= canvas.width) {
    ball.x = canvas.width - ball.r;
    ball.vx *= -1;
  }
  if (ball.y - ball.r <= 0) {
    ball.y = ball.r;
    ball.vy *= -1;
  }

  // Bottom: lose life
  if (ball.y - ball.r > canvas.height) {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      state.paused = true;
      return;
    }
    resetBallOnPaddle();
    return;
  }

  // Paddle collision (only when moving downward)
  if (
    ball.vy > 0 &&
    circleRectCollision(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, paddle.h)
  ) {
    // Bounce up
    ball.y = paddle.y - ball.r - 1;
    ball.vy = -Math.abs(ball.vy);

    // Add "spin" based on where it hits the paddle
    const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // [-1..1]
    ball.vx = hitPos * ball.speed * 1.1;
    // Keep speed reasonable
    const maxVX = ball.speed * 1.4;
    ball.vx = clamp(ball.vx, -maxVX, maxVX);
  }

  // Brick collisions
  for (let r = 0; r < bricks.rows; r++) {
    for (let c = 0; c < bricks.cols; c++) {
      const b = bricks.grid[r][c];
      if (!b.alive) continue;

      const bx = bricks.left + c * (bricks.w + bricks.pad);
      const by = bricks.top + r * (bricks.h + bricks.pad);

      if (circleRectCollision(ball.x, ball.y, ball.r, bx, by, bricks.w, bricks.h)) {
        b.alive = false;
        state.score += 10;

        // Simple bounce: reverse Y (good enough for a starter game)
        ball.vy *= -1;

        // Win check
        if (remainingBricks() === 0) {
          state.gameOver = true;
          state.paused = true;
        }
        return; // avoid multi-hit in one frame
      }
    }
  }
}

// ---------- Draw ----------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bricks
  for (let r = 0; r < bricks.rows; r++) {
    for (let c = 0; c < bricks.cols; c++) {
      const b = bricks.grid[r][c];
      if (!b.alive) continue;

      const x = bricks.left + c * (bricks.w + bricks.pad);
      const y = bricks.top + r * (bricks.h + bricks.pad);

      // Color based on row
      const shade = 210 + r * 5;
      ctx.fillStyle = `hsl(${shade}, 70%, 55%)`;
      roundRect(x, y, bricks.w, bricks.h, 6, true);
    }
  }

  // Paddle
  ctx.fillStyle = "#dbe7ff";
  roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 8, true);

  // Ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // HUD
  ctx.fillStyle = "rgba(219,231,255,0.9)";
  ctx.font = "14px system-ui, Arial";
  ctx.fillText(`Score: ${state.score}`, 14, 24);
  ctx.fillText(`Lives: ${state.lives}`, canvas.width - 80, 24);

  // Overlay text
  if (!state.started && !state.gameOver) {
    centerText("Press SPACE to launch", canvas.height * 0.55);
  }
  if (state.paused && state.started && !state.gameOver) {
    centerText("Paused (SPACE to resume)", canvas.height * 0.55);
  }
  if (state.gameOver) {
    const msg = remainingBricks() === 0 ? "You Win!" : "Game Over";
    centerText(`${msg}  (R to restart)`, canvas.height * 0.55);
  }
}

function centerText(text, y) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "600 18px system-ui, Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, y);
  ctx.restore();
}

// Rounded rectangle helper
function roundRect(x, y, w, h, r, fill) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
}

// ---------- Loop ----------
function loop() {
  if (!state.paused) update();
  draw();
  requestAnimationFrame(loop);
}
loop();
