import { HandTracker } from "./handTracker.js";
import { PuzzleEngine } from "./puzzleEngine.js?v=3";
import { getRandomPuzzleImage } from "./imagePool.js";
import { formatTime } from "./utils.js";

class App {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.video = document.getElementById("webcam-feed");

    this.currentLevel = 1;
    this.maxLevel = 5;
    this.currentImage = null;
    this.isPaused = false;
    this.isolateSkeleton = false;

    // Timer & FPS
    this.timer = 0;
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
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.loadLevel(this.currentLevel);
    await this.tracker.init();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  bindUI() {
    const toggle = document.getElementById("skeleton-toggle");
    if (toggle) {
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

    // Mouse & Touch fallback
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
    img.onerror = (err) => console.error("Image loading error:", err);
    img.src = getRandomPuzzleImage();
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
      this.restartLevel();
    }
  }

  hideModals() {
    const levelBanner = document.getElementById("level-banner");
    if (levelBanner) levelBanner.classList.add("banner-hidden");
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
    if (this.puzzle && this.puzzle.isComplete()) {
      clearInterval(this.timerInterval);
      const levelBanner = document.getElementById("level-banner");
      if (levelBanner) {
        levelBanner.classList.remove("banner-hidden");
      }
    }
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

    // Render repeating watermark pattern
    if (this.watermarkPattern) {
      this.ctx.fillStyle = this.watermarkPattern;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Optional camera underlay
    if (!this.isolateSkeleton && this.video && this.video.readyState >= 2) {
      this.ctx.save();
      this.ctx.translate(this.canvas.width, 0);
      this.ctx.scale(-1, 1);
      this.ctx.globalAlpha = 0.08;
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
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