import { LowPassFilter, getDistance } from "./utils.js";

export class HandTracker {
  constructor(videoElement, onResultsCallback) {
    this.video = videoElement;
    this.onResultsCallback = onResultsCallback;

    // Smoothed pinch cursor state
    this.cursor = {
      x: 0,
      y: 0,
      isPinching: false
    };

    // Low-pass filters for smoothing jitter
    this.filterX = new LowPassFilter(0.65);
    this.filterY = new LowPassFilter(0.65);

    this.rawLandmarks = null;
    this.hands = null;
    this.camera = null;

    // Thresholds
    this.pinchThreshold = 0.055;
    this.releaseThreshold = 0.075;
  }

  async init() {
    if (!window.Hands || !window.Camera) {
      console.error("MediaPipe Hands or Camera script not loaded from CDN.");
      return;
    }

    this.hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });

    this.hands.onResults((results) => this.handleResults(results));

    // Request camera feed
    try {
      this.camera = new window.Camera(this.video, {
        onFrame: async () => {
          await this.hands.send({ image: this.video });
        },
        width: 1280,
        height: 720
      });
      await this.camera.start();
    } catch (err) {
      console.warn("Webcam access denied or unavailable. Running in mouse fallback mode.", err);
    }
  }

  handleResults(results) {
    if (this.onResultsCallback) {
      this.onResultsCallback(results.image);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.rawLandmarks = results.multiHandLandmarks[0];

      // Landmark 4: Thumb Tip | Landmark 8: Index Tip
      const thumb = this.rawLandmarks[4];
      const index = this.rawLandmarks[8];

      // Horizontal flip to match mirrored selfie webcam
      const mirroredThumbX = 1 - thumb.x;
      const mirroredIndexX = 1 - index.x;

      const pinchCenterNormX = (mirroredThumbX + mirroredIndexX) / 2;
      const pinchCenterNormY = (thumb.y + index.y) / 2;

      // Filtered cursor coordinates (normalized 0 to 1)
      this.cursor.x = this.filterX.filter(pinchCenterNormX);
      this.cursor.y = this.filterY.filter(pinchCenterNormY);

      // Measure Euclidean distance between thumb and index tips
      const dist = getDistance(
        { x: thumb.x, y: thumb.y },
        { x: index.x, y: index.y }
      );

      // Hysteresis thresholding to prevent fluttering
      if (this.cursor.isPinching) {
        if (dist > this.releaseThreshold) {
          this.cursor.isPinching = false;
        }
      } else {
        if (dist < this.pinchThreshold) {
          this.cursor.isPinching = true;
        }
      }
    } else {
      this.rawLandmarks = null;
      this.cursor.isPinching = false;
    }
  }

  drawHandSkeleton(ctx, canvasWidth, canvasHeight) {
    if (!this.rawLandmarks) return;

    // Project normalized cursor to actual canvas pixels
    const px = this.cursor.x * canvasWidth;
    const py = this.cursor.y * canvasHeight;

    // Convert raw landmarks to mirrored pixel coordinates
    const points = this.rawLandmarks.map((lm) => ({
      x: (1 - lm.x) * canvasWidth,
      y: lm.y * canvasHeight
    }));

    // Standard 21 MediaPipe hand connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [9, 13], [13, 14], [14, 15], [15, 16],// Ring
      [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [0, 17]                               // Palm base
    ];

    ctx.save();

    // Draw skeletal bones
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 3;
    for (const [startIdx, endIdx] of connections) {
      const p1 = points[startIdx];
      const p2 = points[endIdx];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Draw joint nodes
    for (const pt of points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#c084fc";
      ctx.fill();
    }

    // Draw Pinch Cursor Indicator
    ctx.beginPath();
    ctx.arc(px, py, this.cursor.isPinching ? 14 : 22, 0, Math.PI * 2);
    ctx.strokeStyle = this.cursor.isPinching ? "#22c55e" : "#38bdf8";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = this.cursor.isPinching ? "#22c55e" : "#38bdf8";
    ctx.fill();

    ctx.restore();

    // Map screen pixel space back into interaction coordinates
    this.cursor.x = px;
    this.cursor.y = py;
  }
}