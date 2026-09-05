import { LowPassFilter, getDistance } from "./utils.js";

export class HandTracker {
  constructor(videoElement, onResultsCallback) {
    this.video = videoElement;
    this.callback = onResultsCallback;

    // Smoothed cursor coordinates (0.0 to 1.0)
    this.filterX = new LowPassFilter(0.5);
    this.filterY = new LowPassFilter(0.5);

    this.cursor = {
      x: 0.5,
      y: 0.5,
      isPinching: false,
      pinchDistance: 1.0
    };

    this.landmarks = null;
    this.hands = null;
    this.camera = null;

    // Hysteresis thresholds for stable grab & release
    this.PINCH_START_THRESHOLD = 0.085;  // Easy to grab
    this.PINCH_RELEASE_THRESHOLD = 0.125; // Hard to accidentally drop
  }

  async init() {
    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });

    this.hands.onResults((results) => this.handleResults(results));

    // Initialize camera stream
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });
      this.video.srcObject = stream;
      await this.video.play();

      this.camera = new Camera(this.video, {
        onFrame: async () => {
          if (this.video && this.video.readyState >= 2) {
            await this.hands.send({ image: this.video });
          }
        },
        width: 640,
        height: 480
      });
      this.camera.start();
    }
  }

  handleResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      this.landmarks = landmarks;

      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];

      // Mirror X so moving right moves right on screen
      const rawX = 1 - (thumbTip.x + indexTip.x) / 2;
      const rawY = (thumbTip.y + indexTip.y) / 2;

      this.cursor.x = this.filterX.filter(rawX);
      this.cursor.y = this.filterY.filter(rawY);

      const pinchDist = getDistance(
        { x: thumbTip.x, y: thumbTip.y },
        { x: indexTip.x, y: indexTip.y }
      );
      this.cursor.pinchDistance = pinchDist;

      // Hysteresis pinch trigger
      if (!this.cursor.isPinching) {
        if (pinchDist <= this.PINCH_START_THRESHOLD) {
          this.cursor.isPinching = true;
        }
      } else {
        if (pinchDist > this.PINCH_RELEASE_THRESHOLD) {
          this.cursor.isPinching = false;
        }
      }
    } else {
      this.landmarks = null;
      this.cursor.isPinching = false;
    }

    if (this.callback) {
      this.callback(this.cursor);
    }
  }

  drawHandSkeleton(ctx, canvasWidth, canvasHeight) {
    if (!this.landmarks) return;

    ctx.save();

    const points = this.landmarks.map((lm) => ({
      x: (1 - lm.x) * canvasWidth,
      y: lm.y * canvasHeight
    }));

    // Hand connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17]             // Palm base
    ];

    ctx.strokeStyle = "rgba(168, 85, 247, 0.45)"; // Sleek purple skeleton
    ctx.lineWidth = 2.5;

    for (const [start, end] of connections) {
      ctx.beginPath();
      ctx.moveTo(points[start].x, points[start].y);
      ctx.lineTo(points[end].x, points[end].y);
      ctx.stroke();
    }

    // Joints
    for (let i = 0; i < points.length; i++) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = i === 4 || i === 8 ? "#38bdf8" : "rgba(226, 232, 240, 0.85)";
      ctx.fill();
    }

    // Pinch Target Indicator
    const cursorPixelX = this.cursor.x * canvasWidth;
    const cursorPixelY = this.cursor.y * canvasHeight;

    ctx.beginPath();
    ctx.arc(cursorPixelX, cursorPixelY, this.cursor.isPinching ? 9 : 14, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.cursor.isPinching ? "#22c55e" : "#38bdf8";
    ctx.stroke();

    if (this.cursor.isPinching) {
      ctx.fillStyle = "rgba(34, 197, 94, 0.4)";
      ctx.fill();
    }

    ctx.restore();
  }
}