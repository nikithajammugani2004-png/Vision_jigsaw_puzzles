import { HandTracker } from "./handTracker.js";
import { PuzzleEngine } from "./puzzleEngine.js";
import { getRandomPuzzleImage } from "./imagePool.js";
import { formatTime } from "./utils.js";

class App {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.video = document.getElementById("webcam-feed");
    this.bgCanvas = document.getElementById("bg-watermark-canvas");

    this.currentLevel = 1;
    this.maxLevel = 5;
    this.currentImage = null;
    this.isPaused = false;
    this.isolateSkeleton = false;

    // Performance & Timer tracking
    this.timer = 0;
    this.timerInterval = null;
    this.lastFrameTime = performance.now();
    this.fps = 0;

    // Mouse / Touch fallback dragging state
    this.mouseDragPiece = null;
    this.mouseOffset = { x: 0, y: 0 };

    this.puzzle = new PuzzleEngine();
    this.tracker = new HandTracker(this.video, (image) => this.onTrackerFrame(image));

    this.init();
  }

  async init() {
    this.bindUI();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.loadLevel(this.currentLevel);

    // Initialize camera tracking
    await this.tracker.init();

    // Start render loop
    requestAnimationFrame((ts) => this.loop(ts));
  }

  bindUI() {
    // Isolate skeleton toggle
    const toggle = document.getElementById("skeleton-toggle");
    if (toggle) {
      toggle.addEventListener("change", (e) => {
        this.isolateSkeleton = e.target.checked;
      });
    }

    // Controls
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
      restartLevelBtn.addEventListener("click", () => this.restartLevel());
    }

    const restartGameBtn = document.getElementById("btn-restart-game");
    if (restartGameBtn) {
      restartGameBtn.addEventListener("click", () => this.restartGame());
    }

    // Modal retry / next
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

    // Scoreboard reset
    const resetScoreBtn = document.getElementById("btn-reset-leaderboard");
    if (resetScoreBtn) {
      resetScoreBtn.addEventListener("click", () => this.resetLeaderboard());
    }

    // Fallback Mouse & Touch Events
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
    const levelText = document.getElementById("level-indicator");
    if (levelText) levelText.textContent = `LEVEL ${this.currentLevel}`;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      this.currentImage = img;
      const previewEl = document.getElementById("reference-img");
      if (previewEl) previewEl.src = img.src;

      this.resizeCanvas();
      this.puzzle.setupPuzzle(img, this.currentLevel, this.canvas.width, this.canvas.height);
      this.updateCounters();
      this.startTimer();
    };
    img.onerror = (err) => {
      console.error("Failed to load random puzzle image:", err);
    };

    // Load random Picsum photo
    img.src = getRandomPuzzleImage();
  }

  resizeCanvas() {
    if (this.bgCanvas) {
      this.bgCanvas.width = window.innerWidth;
      this.bgCanvas.height = window.innerHeight;
    }

    const rect = this.canvas.getBoundingClientRect();
    const prevW = this.canvas.width || 1000;
    const prevH = this.canvas.height || 700;

    const newW = Math.round(rect.width) || 800;
    const newH = Math.round(rect.height) || 600;

    this.canvas.width = newW;
    this.canvas.height = newH;

    if (this.puzzle && this.puzzle.pieces && this.puzzle.pieces.length > 0) {
      const scaleX = newW / prevW;
      const scaleY = newH / prevH;

      this.puzzle.boardWidth = Math.min(newW * 0.52, newH * 0.65);
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

  startTimer() {
    clearInterval(this.timerInterval);
    this.timer = 0;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.timer++;
        this.updateTimerDisplay();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const timerEl = document.getElementById("timer-display");
    if (timerEl) {
      timerEl.textContent = formatTime(this.timer);
    }
  }

  updateCounters() {
    const remainingEl = document.getElementById("remaining-pieces");
    if (remainingEl && this.puzzle) {
      const remaining = this.puzzle.pieces.filter((p) => !p.isSnapped).length;
      remainingEl.textContent = `${remaining} / ${this.puzzle.pieces.length}`;
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    const banner = document.getElementById("pause-banner");
    if (banner) {
      banner.classList.toggle("banner-hidden", !this.isPaused);
    }
  }

  restartLevel() {
    this.hideModals();
    this.loadLevel(this.currentLevel);
  }

  restartGame() {
    this.hideModals();
    this.currentLevel = 1;
    this.loadLevel(1);
  }

  nextLevel() {
    if (this.currentLevel < this.maxLevel) {
      this.currentLevel++;
      this.loadLevel(this.currentLevel);
    } else {
      alert("Congratulations! You completed all jigsaw puzzle levels!");
      this.restartGame();
    }
  }

  hideModals() {
    const levelBanner = document.getElementById("level-banner");
    if (levelBanner) levelBanner.classList.add("banner-hidden");

    const pauseBanner = document.getElementById("pause-banner");
    if (pauseBanner) pauseBanner.classList.add("banner-hidden");

    const gameOverBanner = document.getElementById("gameover-banner");
    if (gameOverBanner) gameOverBanner.classList.add("banner-hidden");
  }

  onTrackerFrame() {
    // Called when hand tracker processes a camera frame
  }

  // Mouse & Touch fallback controls
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

      // Bring to top of stack
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
    if (this.puzzle && this.puzzle.isComplete()) {
      clearInterval(this.timerInterval);
      const levelBanner = document.getElementById("level-banner");
      if (levelBanner) {
        levelBanner.classList.remove("banner-hidden");
      }
    }
  }

  loop(timestamp) {
    // Calculate FPS
    const delta = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.fps = Math.round(1000 / (delta || 1));
    const fpsEl = document.getElementById("fps-display");
    if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background webcam feed or dark slate
    if (!this.isolateSkeleton && this.video && this.video.readyState >= 2) {
      this.ctx.save();
      this.ctx.translate(this.canvas.width, 0);
      this.ctx.scale(-1, 1);
      this.ctx.globalAlpha = 0.35;
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    } else {
      this.ctx.fillStyle = "#090a0f";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (!this.isPaused && this.puzzle) {
      // Update gesture pinch interaction
      const cursor = this.tracker.cursor;
      this.puzzle.updateInteraction(cursor);
      this.updateCounters();
      this.checkWinCondition();

      // Render puzzle target board & pieces
      this.puzzle.drawBoard(this.ctx);
      this.puzzle.drawPieces(this.ctx);

      // Draw hand landmarks and cursor
      this.tracker.drawHandSkeleton(this.ctx, this.canvas.width, this.canvas.height);
    }

    requestAnimationFrame((ts) => this.loop(ts));
  }

  resetLeaderboard() {
    localStorage.removeItem("jigsaw_leaderboard");
    const container = document.getElementById("scoreboard-list");
    if (container) {
      container.innerHTML = `<div class="empty-score">No records yet</div>`;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new App();
});