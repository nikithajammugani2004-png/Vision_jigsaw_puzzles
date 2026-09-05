import { LowPassFilter, getDistance } from "./utils.js";

export class HandTracker {
  constructor(videoElement, onFrameCallback) {
    this.video = videoElement;
    this.onFrame = onFrameCallback;
    this.hands = null;
    this.camera = null;

    // Responsive filter: 0.65 reduces lag while smoothing micro-tremors
    this.filterX = new LowPassFilter(0.65);
    this.filterY = new LowPassFilter(0.65);

    this.cursor = { x: 0, y: 0, isPinching: false };
    this.pinchThreshold = 65; // Relaxed grab distance to avoid drops
    this.releaseThreshold = 85; // Hysteresis prevents rapid grab/release flicker
    this.landmarks = null;
  }

  async init() {
    this.hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    // Add catch block when camera starts
    this.camera.start().catch((err) => {
        console.error("Camera access error:", err);
        const modeText = document.getElementById("mode-text");
        if (modeText) modeText.textContent = "Camera Blocked / Unavailable";
        alert("Please allow camera access in your browser to interact with the puzzle!");
});
    

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    this.hands.onResults((results) => this.handleResults(results));

    this.camera = new window.Camera(this.video, {
      onFrame: async () => {
        await this.hands.send({ image: this.video });
      },
      width: 1280,
      height: 720
    });

    return this.camera.start().catch((err) => {
      console.error("Camera access failed:", err);
      const modeText = document.getElementById("mode-text");
      if (modeText) modeText.textContent = "Camera Blocked";
      alert("Camera access is blocked or unavailable. Please enable camera permissions to play using gestures!");
    });
  }

  handleResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const rawLandmarks = results.multiHandLandmarks[0];
      this.landmarks = rawLandmarks;

      const thumbTip = rawLandmarks[4];
      const indexTip = rawLandmarks[8];

      // Use the actual canvas box dimensions so points map 1:1
      const canvas = document.getElementById("game-canvas");
      const canvasWidth = canvas ? canvas.width : 1000;
      const canvasHeight = canvas ? canvas.height : 700;

      // Coordinate scaling matching canvas aspect
      const pIndex = {
        x: (1 - indexTip.x) * canvasWidth,
        y: indexTip.y * canvasHeight
      };

      const pThumb = {
        x: (1 - thumbTip.x) * canvasWidth,
        y: thumbTip.y * canvasHeight
      };

      // Anchor cursor to the midpoint between thumb & index tips for natural grab feel
      const midPointX = (pIndex.x + pThumb.x) / 2;
      const midPointY = (pIndex.y + pThumb.y) / 2;

      const smoothX = this.filterX.filter(midPointX);
      const smoothY = this.filterY.filter(midPointY);

      const pinchDist = getDistance(pIndex, pThumb);
      
      // Dual-threshold (hysteresis) check prevents jittery grabbing
      let isPinching = this.cursor.isPinching;
      if (!isPinching && pinchDist < this.pinchThreshold) {
        isPinching = true;
      } else if (isPinching && pinchDist > this.releaseThreshold) {
        isPinching = false;
      }

      this.cursor = {
        x: smoothX,
        y: smoothY,
        isPinching: isPinching
      };
    } else {
      this.landmarks = null;
      this.cursor.isPinching = false;
      this.filterX.reset();
      this.filterY.reset();
    }

    if (this.onFrame) {
      this.onFrame(results.image);
    }
  }

  drawHandSkeleton(ctx, canvasWidth, canvasHeight) {
    if (!this.landmarks) return;

    ctx.save();
    const points = this.landmarks.map((lm) => ({
      x: (1 - lm.x) * canvasWidth,
      y: lm.y * canvasHeight
    }));

    // Draw hand skeleton lines
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    for (const [start, end] of connections) {
      ctx.beginPath();
      ctx.moveTo(points[start].x, points[start].y);
      ctx.lineTo(points[end].x, points[end].y);
      ctx.stroke();
    }

    // Draw joint dots
    ctx.fillStyle = this.cursor.isPinching ? "#38bdf8" : "#f43f5e";
    for (let pt of points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Active grab cursor
    ctx.beginPath();
    ctx.arc(this.cursor.x, this.cursor.y, this.cursor.isPinching ? 16 : 10, 0, 2 * Math.PI);
    ctx.strokeStyle = this.cursor.isPinching ? "#38bdf8" : "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.cursor.isPinching ? "#38bdf8" : "transparent";
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.restore();
  }
}