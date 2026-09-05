import { HandTracker } from "./handTracker.js";
import { PuzzleEngine } from "./puzzleEngine.js?v=4";
import { getRandomPuzzleImage } from "./imagePool.js";
import { formatTime } from "./utils.js";

class App {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.video = document.getElementById("webcam-feed");

    this.currentLevel = 1;
    this.maxLevel = 3;
    this.currentImage = null;
    this.isPaused = false;
    this.isolateSkeleton = false;
    this.isLevelTransitioning = false;

    // Level durations in seconds
    // Level 1: 4x4 (120s), Level 2: 5x5 (180s), Level 3: 6x6 (240s)
    this.levelTimes = { 1: 120, 2: 180, 3: 240 };
    this.timeRemaining = 120;
    this.timerInterval = null;

    this.lastFrameTime = performance.now();
    this.fps = 0;

    // Mouse fallback
    this.mouseDragPiece = null;
    this.mouseOffset = { x: 0, y: 0 };

    this.puzzle = new PuzzleEngine();
    this.tracker = new HandTracker(this.video, () => {});

    this.watermarkPattern = null;
    this.createWatermarkPattern();

    this.init();
  }

  createWatermarkPattern() {
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = 300;
    patternCanvas.height = 160;
    const pCtx = patternCanvas.getContext("2d");

    pCtx.font = "bold 13px system-ui, -apple-system, sans-serif";
    pCtx.fillStyle = "rgba(255, 255, 255, 0.055)";
    pCtx.textAlign = "center";
    pCtx.textBaseline = "middle";

    pCtx.fillText("•  VISION JIGSAW  •", 150, 45);
    pCtx.fillText("•  VISION JIGSAW  •", 0, 125);
    pCtx.fillText("•  VISION JIGSAW  •", 300, 125);

    this.watermarkPattern = this.ctx.createPattern(patternCanvas, "repeat");
  }

  async init() {
    this.bindUI();
    this.renderLeaderboard();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.loadLevel(this.currentLevel);
    await this.tracker.init();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  bindUI() {
    const toggle = document.getElementById("skeleton-toggle");
    if (toggle) {
      this.isolateSkeleton = toggle.checked;
      toggle.addEventListener("change", (e) => {
        this.isolateSkeleton = e.target.checked;
      });
    }

    const retryBtn = document.getElementById("btn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        this.hideModals();
        this.restartLevel();
      });
    }

    const nextBtn = document.getElementById("btn-next-level");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        this.hideModals();
        this.nextLevel();
      });
    }

    const goRetryBtn = document.getElementById("btn-gameover-retry");
    if (goRetryBtn) {
      goRetryBtn.addEventListener("click", () => {
        this.hideModals();
        this.restartLevel();
      });
    }

   const resetScoreBtn = document.getElementById("btn-reset-leaderboard");
    if (resetScoreBtn) {
      resetScoreBtn.addEventListener("click", () => this.resetLeaderboard());
    }

    const pauseBtn = document.getElementById("btn-pause");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => this.togglePause());
    }

    const resumeBtn = document.getElementById("btn-resume");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => this.togglePause());
    }

    const restartLevelBtn = document.getElementById("btn-restart-level");
    if (restartLevelBtn) {
      restartLevelBtn.addEventListener("click", () => {
        this.isPaused = false;
        this.hideModals();
        this.restartLevel();
      });
    }

    const restartGameBtn = document.getElementById("btn-restart-game");
    if (restartGameBtn) {
      restartGameBtn.addEventListener("click", () => {
        this.isPaused = false;
        this.hideModals();
        this.currentLevel = 1;
        this.loadLevel(1);
      });
    }

    // Mouse fallback
    this.canvas.addEventListener("mousedown", (e) => this.handlePointerDown(e));
    window.addEventListener("mousemove", (e) => this.handlePointerMove(e));
    window.addEventListener("mouseup", () => this.handlePointerUp());

    this.canvas.addEventListener("touchstart", (e) => this.handlePointerDown(e.touches[0]), { passive: false });
    window.addEventListener("touchmove", (e) => {
      if (this.mouseDragPiece) e.preventDefault();
      this.handlePointerMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener("touchend", () => this.handlePointerUp());
  }

  loadLevel(level) {
    this.currentLevel = level;
    const gridLabel = level === 1 ? "4x4" : level === 2 ? "5x5" : "6x6";
    const levelText = document.getElementById("level-indicator");
    if (levelText) levelText.textContent = `LEVEL ${this.currentLevel} (${gridLabel})`;

    this.timeRemaining = this.levelTimes[this.currentLevel] || 120;
    this.updateTimerDisplay();

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      this.currentImage = img;
      const previewEl = document.getElementById("reference-img");
      if (previewEl) previewEl.src = img.src;

      this.resizeCanvas();
      this.puzzle.setupPuzzle(img, this.currentLevel, this.canvas.width, this.canvas.height);
      this.updateCounters();
      this.startCountdown();
    };
    img.onerror = (err) => console.error("Image loading error:", err);
    img.src = getRandomPuzzleImage();
  }

  startCountdown() {
    clearInterval(this.timerInterval);
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.timeRemaining--;
        this.updateTimerDisplay();

        if (this.timeRemaining <= 0) {
          clearInterval(this.timerInterval);
          this.triggerGameOver();
        }
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const timerEl = document.getElementById("timer-display");
    if (timerEl) {
      timerEl.textContent = formatTime(Math.max(0, this.timeRemaining));
    }
  }

  triggerGameOver() {
    const banner = document.getElementById("gameover-banner");
    if (banner) banner.classList.remove("banner-hidden");
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const prevW = this.canvas.width || 1000;
    const prevH = this.canvas.height || 700;

    const newW = Math.round(rect.width) || 800;
    const newH = Math.round(rect.height) || 600;

    this.canvas.width = newW;
    this.canvas.height = newH;

    this.createWatermarkPattern();

    if (this.puzzle && this.puzzle.pieces && this.puzzle.pieces.length > 0) {
      const scaleX = newW / prevW;
      const scaleY = newH / prevH;

      this.puzzle.boardWidth = Math.min(newW * 0.44, newH * 0.68);
      this.puzzle.boardHeight = this.puzzle.boardWidth;
      this.puzzle.boardX = (newW - this.puzzle.boardWidth) / 2;
      this.puzzle.boardY = (newH - this.puzzle.boardHeight) / 2;

      for (const piece of this.puzzle.pieces) {
        piece.width = this.puzzle.boardWidth / this.puzzle.gridCols;
        piece.height = this.puzzle.boardHeight / this.puzzle.gridRows;
        piece.targetX = this.puzzle.boardX + piece.col * piece.width;
        piece.targetY = this.puzzle.boardY + piece.row * piece.height;

        if (piece.isSnapped) {
          piece.currentX = piece.targetX;
          piece.currentY = piece.targetY;
        } else {
          piece.currentX = Math.min(newW - piece.width, Math.max(0, piece.currentX * scaleX));
          piece.currentY = Math.min(newH - piece.height, Math.max(0, piece.currentY * scaleY));
        }
      }
    } else if (this.currentImage) {
      this.puzzle.setupPuzzle(this.currentImage, this.currentLevel, newW, newH);
    }
  }

  updateCounters() {
    const remainingEl = document.getElementById("remaining-pieces");
    if (remainingEl && this.puzzle && this.puzzle.pieces) {
      const remaining = this.puzzle.pieces.filter((p) => !p.isSnapped).length;
      remainingEl.textContent = `${remaining} / ${this.puzzle.pieces.length}`;
    }
  }

  restartLevel() {
    this.hideModals();
    this.loadLevel(this.currentLevel);
  }

  nextLevel() {
    if (this.currentLevel < this.maxLevel) {
      this.currentLevel++;
      this.loadLevel(this.currentLevel);
    } else {
      alert("All levels cleared! Restarting from Level 1.");
      this.currentLevel = 1;
      this.loadLevel(1);
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseBanner = document.getElementById("pause-banner");
    const pauseBtn = document.getElementById("btn-pause");
    if (this.isPaused) {
      if (pauseBanner) pauseBanner.classList.remove("banner-hidden");
      if (pauseBtn) pauseBtn.innerHTML = `<span class="icon">▶</span> Resume`;
    } else {
      if (pauseBanner) pauseBanner.classList.add("banner-hidden");
      if (pauseBtn) pauseBtn.innerHTML = `<span class="icon">⏸</span> Pause`;
    }
  }

  hideModals() {
    const levelBanner = document.getElementById("level-banner");
    if (levelBanner) levelBanner.classList.add("banner-hidden");

    const gameOverBanner = document.getElementById("gameover-banner");
    if (gameOverBanner) gameOverBanner.classList.add("banner-hidden");

    const pauseBanner = document.getElementById("pause-banner");
    if (pauseBanner) pauseBanner.classList.add("banner-hidden");
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }

  handlePointerDown(e) {
    if (this.isPaused || !this.puzzle) return;
    const { x, y } = this.getCanvasCoords(e);
    const piece = this.puzzle.getPieceAt(x, y);

    if (piece && !piece.isSnapped) {
      this.mouseDragPiece = piece;
      this.mouseOffset.x = x - piece.currentX;
      this.mouseOffset.y = y - piece.currentY;

      const idx = this.puzzle.pieces.indexOf(piece);
      this.puzzle.pieces.splice(idx, 1);
      this.puzzle.pieces.push(piece);
    }
  }

  handlePointerMove(e) {
    if (!this.mouseDragPiece || this.isPaused) return;
    const { x, y } = this.getCanvasCoords(e);
    this.mouseDragPiece.currentX = x - this.mouseOffset.x;
    this.mouseDragPiece.currentY = y - this.mouseOffset.y;
  }

  handlePointerUp() {
    if (this.mouseDragPiece) {
      this.puzzle.checkSnap(this.mouseDragPiece);
      this.mouseDragPiece = null;
      this.updateCounters();
      this.checkWinCondition();
    }
  }

  checkWinCondition() {
    if (this.puzzle && this.puzzle.isComplete() && !this.isLevelTransitioning) {
      this.isLevelTransitioning = true;
      clearInterval(this.timerInterval);

      // Save to leaderboard
      const gridLabel = this.currentLevel === 1 ? "4x4" : this.currentLevel === 2 ? "5x5" : "6x6";
      this.saveScore(`Level ${this.currentLevel} (${gridLabel})`, formatTime(this.timeRemaining));

      const winMsg = document.getElementById("level-win-msg");
      if (winMsg) {
        winMsg.textContent = `Completed with ${formatTime(this.timeRemaining)} left! Loading next level...`;
      }

      const levelBanner = document.getElementById("level-banner");
      if (levelBanner) {
        levelBanner.classList.remove("banner-hidden");
      }

      // Automatically advance to the next level after 2 seconds
      setTimeout(() => {
        this.hideModals();
        this.isLevelTransitioning = false;
        this.nextLevel();
      }, 2000);
    }
  }

  saveScore(levelStr, timeStr) {
    const scores = JSON.parse(localStorage.getItem("vision_jigsaw_scores") || "[]");
    scores.unshift({ level: levelStr, time: timeStr, date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    if (scores.length > 5) scores.pop();
    localStorage.setItem("vision_jigsaw_scores", JSON.stringify(scores));
    this.renderLeaderboard();
  }

  renderLeaderboard() {
    const container = document.getElementById("scoreboard-list");
    if (!container) return;

    const scores = JSON.parse(localStorage.getItem("vision_jigsaw_scores") || "[]");
    if (scores.length === 0) {
      container.innerHTML = `<div class="empty-score">No records yet</div>`;
      return;
    }

    container.innerHTML = scores
      .map(
        (s) => `
        <div class="score-entry">
          <span class="entry-level">${s.level}</span>
          <span class="entry-time cyan">${s.time} left</span>
        </div>`
      )
      .join("");
  }

  resetLeaderboard() {
    localStorage.removeItem("vision_jigsaw_scores");
    this.renderLeaderboard();
  }

  loop(timestamp) {
    const delta = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.fps = Math.round(1000 / (delta || 1));
    const fpsEl = document.getElementById("fps-display");
    if (fpsEl) fpsEl.textContent = `${this.fps}`;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Dark solid canvas background
    this.ctx.fillStyle = "#0c0d12";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Bright camera feed when isolation toggle is off
    if (!this.isolateSkeleton && this.video && this.video.readyState >= 2) {
      this.ctx.save();
      this.ctx.translate(this.canvas.width, 0);
      this.ctx.scale(-1, 1);
      this.ctx.globalAlpha = 0.55; // Clear & bright webcam feed
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // Render watermark
    if (this.watermarkPattern) {
      this.ctx.fillStyle = this.watermarkPattern;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (!this.isPaused && this.puzzle) {
      const cursor = this.tracker.cursor;
      this.puzzle.updateInteraction(cursor, this.canvas.width, this.canvas.height);
      this.updateCounters();
      this.checkWinCondition();

      this.puzzle.drawBoard(this.ctx);
      this.puzzle.drawPieces(this.ctx);

      this.tracker.drawHandSkeleton(this.ctx, this.canvas.width, this.canvas.height);
    }

    requestAnimationFrame((ts) => this.loop(ts));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new App();
});