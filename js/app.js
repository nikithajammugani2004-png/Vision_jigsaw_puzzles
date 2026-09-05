import { ImageManager } from "./imagePool.js";
import { PuzzleEngine } from "./puzzleEngine.js";
import { HandTracker } from "./handTracker.js";

class JigsawApp {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.video = document.getElementById("webcam-feed");

    this.bgCanvas = document.getElementById("bg-watermark-canvas");
    this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext("2d") : null;

    this.refImgElement = document.getElementById("ref-img");
    this.levelTitle = document.getElementById("level-title");
    this.piecesCounter = document.getElementById("pieces-counter");
    this.fpsCounter = document.getElementById("fps-counter");
    this.levelBanner = document.getElementById("level-banner");
    this.isolateToggle = document.getElementById("isolateToggle");

    this.imageManager = new ImageManager();
    this.puzzle = new PuzzleEngine();
    this.handTracker = null;

    this.currentLevel = 1;
    this.currentImage = null;
    this.wasPinching = false;
    this.audioCtx = null;

    // Timer & Leaderboard states
    this.timerElement = document.getElementById("timer-counter");
    this.scoreboardList = document.getElementById("scoreboard-list");
    this.clearScoresBtn = document.getElementById("clear-scores-btn");
    this.clearTimeText = document.getElementById("clear-time-text");
    this.nameInput = document.getElementById("player-name-input");
    this.saveScoreBtn = document.getElementById("save-score-btn");

    this.gameoverBanner = document.getElementById("gameover-banner");
    this.quitNameInput = document.getElementById("quit-name-input");
    this.retryBtn = document.getElementById("retry-btn");
    this.quitBtn = document.getElementById("quit-btn");

    this.restartLevelBtn = document.getElementById("restart-level-btn");
    this.restartGameBtn = document.getElementById("restart-game-btn");
    this.pauseBtn = document.getElementById("pause-btn");
    this.pauseBanner = document.getElementById("pause-banner");
    this.resumeBtn = document.getElementById("resume-btn");
    this.isPaused = false;

    this.remainingSeconds = 120;
    this.levelTimeLimit = 120;
    this.timerInterval = null;
    this.isGameActive = false;
    this.totalCompletedPieces = 0;

    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fps = 0;
    this.watermarkOffset = 0;

    this.initScoreboardEvents();
    this.renderScoreboard();
    this.init();
  }

  async init() {
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.handTracker = new HandTracker(this.video, (cameraFrame) => {
      this.render(cameraFrame);
    });


    try {
      await this.handTracker.init();
      await this.loadLevel(this.currentLevel);
    } catch (err) {
      console.error("Initialization error:", err);
    }
    let isMouseDown = false;

this.canvas.addEventListener("mousedown", (e) => {
  const rect = this.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  isMouseDown = true;
  this.puzzle.handlePointerDown(x, y);
});

this.canvas.addEventListener("mousemove", (e) => {
  if (!isMouseDown) return;
  const rect = this.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  this.puzzle.handlePointerMove(x, y);
});

window.addEventListener("mouseup", () => {
  if (!isMouseDown) return;
  isMouseDown = false;
  const snapped = this.puzzle.handlePointerUp();
  if (snapped) {
    this.playSnapSound();
    this.updateCounters();
    if (this.puzzle.isLevelComplete()) this.triggerLevelWin();
  }
});
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

    // Rescale pieces and board proportionally without resetting game progress
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
      this.puzzle.setupPuzzle(
        this.currentImage,
        this.currentLevel,
        newW,
        newH
      );
    }
  }

  async loadLevel(level) {
    this.isPaused = false;
    if (this.pauseBanner) this.pauseBanner.classList.add("banner-hidden");
    if (this.pauseBtn) this.pauseBtn.innerHTML = "⏸️ Pause";

    this.levelBanner.classList.add("banner-hidden");
    this.levelTitle.textContent = `LEVEL ${level}`;

    const { img, url } = await this.imageManager.loadImage();
    this.currentImage = img;
    this.refImgElement.src = url;

    this.puzzle.setupPuzzle(
      this.currentImage,
      this.currentLevel,
      this.canvas.width,
      this.canvas.height
    );

    this.updateCounters();
    this.startTimer();
  }

  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playSnapSound() {
    this.initAudio();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(420, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(840, this.audioCtx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.08);
  }

  playWinSound() {
    this.initAudio();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
    notes.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.1);

      gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.1 + 0.25);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime + idx * 0.1);
      osc.stop(this.audioCtx.currentTime + idx * 0.1 + 0.25);
    });
  }

  getTimeLimitForLevel(level) {
    if (level === 1) return 120;  // 4x4 -> 2:00 min
    if (level === 2) return 180;  // 5x5 -> 3:00 min
    return 240;                    // 6x6 -> 4:00 min
  }

  startTimer() {
    this.stopTimer();
    this.levelTimeLimit = this.getTimeLimitForLevel(this.currentLevel);
    this.remainingSeconds = this.levelTimeLimit;
    this.isGameActive = true;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (!this.isGameActive) return;
      this.remainingSeconds--;
      this.updateTimerDisplay();

      if (this.remainingSeconds <= 0) {
        this.stopTimer();
        this.triggerTimeOut();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const mins = String(Math.floor(this.remainingSeconds / 120)).padStart(2, "0");
    const secs = String(this.remainingSeconds % 120).padStart(2, "0");
    if (this.timerElement) {
      this.timerElement.textContent = `${mins}:${secs}`;
      this.timerElement.style.color = this.remainingSeconds <= 10 ? "#ef4444" : "#38bdf8";
    }
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isGameActive = false;
  }

  getFormattedTime(totalSecs) {
    const mins = String(Math.floor(totalSecs / 60)).padStart(2, "0");
    const secs = String(totalSecs % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  triggerTimeOut() {
    if (this.gameoverBanner) {
      this.gameoverBanner.classList.remove("banner-hidden");
    }
  }

  getScores() {
    try {
      return JSON.parse(localStorage.getItem("jigsaw_scores")) || [];
    } catch {
      return [];
    }
  }

  saveScore(name, snappedPieces, level) {
    const scores = this.getScores();
    scores.push({
      name: name.trim() || "Player",
      pieces: snappedPieces,
      level: level,
      date: new Date().toLocaleDateString()
    });
    // Higher score/pieces solved ranks highest
    scores.sort((a, b) => b.pieces - a.pieces || b.level - a.level);
    localStorage.setItem("jigsaw_scores", JSON.stringify(scores.slice(0, 10)));
    this.renderScoreboard();
  }

  renderScoreboard() {
    if (!this.scoreboardList) return;
    const scores = this.getScores();
    if (scores.length === 0) {
      this.scoreboardList.innerHTML = `<div class="empty-score">No records yet</div>`;
      return;
    }

    this.scoreboardList.innerHTML = scores
      .map(
        (s, idx) => `
      <div class="score-row">
        <span class="score-rank">#${idx + 1}</span>
        <span class="score-name">${s.name} (Lvl ${s.level})</span>
        <span class="score-time">${s.pieces} pts</span>
      </div>
    `
      )
      .join("");
  }

  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      // Freeze timer
      this.isGameActive = false;
      if (this.pauseBanner) this.pauseBanner.classList.remove("banner-hidden");
      if (this.pauseBtn) this.pauseBtn.innerHTML = "▶️ Resume";
      if (this.modeText) this.modeText.textContent = "Paused";

      // If holding a piece, drop it cleanly
      if (this.puzzle && this.puzzle.activePiece) {
        this.puzzle.activePiece.isDragging = false;
        this.puzzle.activePiece = null;
      }
    } else {
      // Resume timer
      this.isGameActive = true;
      if (this.pauseBanner) this.pauseBanner.classList.add("banner-hidden");
      if (this.pauseBtn) this.pauseBtn.innerHTML = "⏸️ Pause";
      if (this.modeText) this.modeText.textContent = "Resumed";
    }
  }

  initScoreboardEvents() {
    if (this.clearScoresBtn) {
      this.clearScoresBtn.addEventListener("click", () => {
        localStorage.removeItem("jigsaw_scores");
        this.renderScoreboard();
      });
      // Restart only current level (keeps earned overall score intact)
    if (this.restartLevelBtn) {
      this.restartLevelBtn.addEventListener("click", () => {
        if (this.gameoverBanner) this.gameoverBanner.classList.add("banner-hidden");
        if (this.levelBanner) this.levelBanner.classList.add("banner-hidden");
        this.loadLevel(this.currentLevel);
      });
    }

    // Restart entire game (resets to Level 1, resets score accumulator)
    if (this.restartGameBtn) {
      this.restartGameBtn.addEventListener("click", () => {
        if (confirm("Restart game from Level 1? Your current unsaved progress will reset.")) {
          if (this.gameoverBanner) this.gameoverBanner.classList.add("banner-hidden");
          if (this.levelBanner) this.levelBanner.classList.add("banner-hidden");
          this.currentLevel = 1;
          this.totalCompletedPieces = 0;
          this.loadLevel(this.currentLevel);
        }
      });
    }
    }

    if (this.saveScoreBtn) {
      this.saveScoreBtn.addEventListener("click", () => {
        const name = this.nameInput.value || "Player";
        const levelPieces = this.puzzle.pieces.filter((p) => p.isSnapped).length;
        this.totalCompletedPieces += levelPieces;
        this.saveScore(name, this.totalCompletedPieces, this.currentLevel);

        this.levelBanner.classList.add("banner-hidden");
        this.nameInput.value = "";
        this.currentLevel++;
        this.loadLevel(this.currentLevel);
      });
    }

    // Retry Level button
    if (this.retryBtn) {
      this.retryBtn.addEventListener("click", () => {
        this.gameoverBanner.classList.add("banner-hidden");
        this.loadLevel(this.currentLevel);
      });
    }

    // Quit & Save Score button
    if (this.quitBtn) {
      this.quitBtn.addEventListener("click", () => {
        const name = this.quitNameInput.value || "Player";
        const currentSnapped = this.puzzle.pieces.filter((p) => p.isSnapped).length;
        const finalScore = this.totalCompletedPieces + currentSnapped;

        this.saveScore(name, finalScore, this.currentLevel);
        this.gameoverBanner.classList.add("banner-hidden");
        this.quitNameInput.value = "";

        // Reset back to Level 1
        this.currentLevel = 1;
        this.totalCompletedPieces = 0;
        this.loadLevel(this.currentLevel);
      });
    }

    // Pause button click
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener("click", () => this.togglePause());
    }

    // Resume button on overlay click
    if (this.resumeBtn) {
      this.resumeBtn.addEventListener("click", () => this.togglePause());
    }

    // Mouse & Touch fallback controls
    let isInteracting = false;

    const getCanvasCoords = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (this.canvas.width / rect.width),
        y: (clientY - rect.top) * (this.canvas.height / rect.height)
      };
    };

    const handlePointerStart = (e) => {
      if (this.isPaused) return;
      const { x, y } = getCanvasCoords(e);
      isInteracting = true;
      this.puzzle.handlePointerDown(x, y);
    };

    const handlePointerDrag = (e) => {
      if (!isInteracting || this.isPaused) return;
      const { x, y } = getCanvasCoords(e);
      this.puzzle.handlePointerMove(x, y);
    };

    const handlePointerRelease = () => {
      if (!isInteracting) return;
      isInteracting = false;
      const snapped = this.puzzle.handlePointerUp();
      if (snapped) {
        this.playSnapSound();
        this.updateCounters();
        if (this.puzzle.isLevelComplete()) {
          this.triggerLevelWin();
        }
      }
    };

    this.canvas.addEventListener("mousedown", handlePointerStart);
    window.addEventListener("mousemove", handlePointerDrag);
    window.addEventListener("mouseup", handlePointerRelease);

    this.canvas.addEventListener("touchstart", handlePointerStart, { passive: true });
    window.addEventListener("touchmove", handlePointerDrag, { passive: true });
    window.addEventListener("touchend", handlePointerRelease);
  }

  updateCounters() {
    const remaining = this.puzzle.getRemainingCount();
    const total = this.puzzle.pieces.length;
    this.piecesCounter.textContent = `${total - remaining} / ${total}`;
  }

  handleGestures() {
    if (this.isPaused) return; // Prevent grabbing and dragging while paused

    const { x, y, isPinching } = this.handTracker.cursor;

    if (isPinching && !this.wasPinching) {
      this.puzzle.handlePointerDown(x, y);
    } else if (isPinching && this.wasPinching) {
      this.puzzle.handlePointerMove(x, y);
    } else if (!isPinching && this.wasPinching) {
      const snapped = this.puzzle.handlePointerUp();
      if (snapped) {
        this.playSnapSound();
        this.updateCounters();
        if (this.puzzle.isLevelComplete()) {
          this.triggerLevelWin();
        }
      }
    }

    this.wasPinching = isPinching;
  }

  triggerLevelWin() {
    this.stopTimer();
    this.playWinSound();
    const timeTaken = this.levelTimeLimit - this.remainingSeconds;
    if (this.clearTimeText) {
      this.clearTimeText.textContent = `Completed in ${this.getFormattedTime(timeTaken)}!`;
    }
    this.levelBanner.classList.remove("banner-hidden");
    if (this.nameInput) {
      this.nameInput.focus();
    }
  }

  computeFPS() {
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
      this.fpsCounter.textContent = this.fps;
    }
  }

  drawWatermarkTheme() {
    if (!this.bgCtx) return;

    this.watermarkOffset = (this.watermarkOffset + 0.5) % 360;

    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    this.bgCtx.clearRect(0, 0, w, h);
    this.bgCtx.save();

    this.bgCtx.font = "800 26px 'Plus Jakarta Sans', sans-serif";
    this.bgCtx.fillStyle = "rgba(255, 255, 255, 0.12)";
    this.bgCtx.textBaseline = "middle";

    const text = "VISION JIGSAW  ★  ";
    const spacingX = 280;
    const spacingY = 90;

    this.bgCtx.rotate((-14 * Math.PI) / 180);

    const startX = -w;
    const endX = w * 2;
    const startY = -h;
    const endY = h * 2;

    for (let y = startY; y < endY; y += spacingY) {
      const rowShift = (y / spacingY) % 2 === 0 ? this.watermarkOffset : -this.watermarkOffset;
      for (let x = startX; x < endX; x += spacingX) {
        this.bgCtx.fillText(text, x + rowShift, y);
      }
    }

    this.bgCtx.restore();
  }

  render(cameraFrame) {
    this.computeFPS();
    this.handleGestures();
    this.drawWatermarkTheme();

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const isIsolated = this.isolateToggle && this.isolateToggle.checked;

    if (isIsolated) {
      // Solid dark background — no camera feed
      this.ctx.fillStyle = "#090a0f";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Draw mirrored webcam frame
      if (cameraFrame) {
        this.ctx.save();
        this.ctx.translate(this.canvas.width, 0);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(cameraFrame, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
      }

      // Semi-transparent dimming layer over camera feed
      this.ctx.fillStyle = "rgba(11, 15, 25, 0.4)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Animated diagonal background watermark
    this.drawWatermarkTheme();

    // Draw jigsaw-shaped puzzle board slots
    this.puzzle.drawBoardArea(this.ctx);

    // Draw pieces
    if (this.currentImage) {
      for (const piece of this.puzzle.pieces) {
        piece.draw(this.ctx, this.currentImage);
      }
    }

    // Draw hand landmarks and cursor
    this.handTracker.drawHandSkeleton(this.ctx, this.canvas.width, this.canvas.height);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new JigsawApp();
});