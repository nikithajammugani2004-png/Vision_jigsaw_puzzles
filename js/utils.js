// Low-pass filter for smoothing hand landmark jitter
export class LowPassFilter {
  constructor(alpha = 0.65) {
    this.alpha = alpha;
    this.prev = null;
  }

  filter(val) {
    if (this.prev === null) {
      this.prev = val;
      return val;
    }
    const current = this.alpha * val + (1 - this.alpha) * this.prev;
    this.prev = current;
    return current;
  }

  reset() {
    this.prev = null;
  }
}

// Euclidean distance helper
export function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Format seconds into MM:SS format
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Check if a 2D coordinate is inside a rectangular bounding box
export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

// Random range helper
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}