export class LowPassFilter {
  constructor(alpha = 0.5) {
    this.alpha = alpha;
    this.value = null;
  }

  filter(val) {
    if (this.value === null) {
      this.value = val;
      return val;
    }
    this.value = this.alpha * val + (1 - this.alpha) * this.value;
    return this.value;
  }

  reset() {
    this.value = null;
  }
}

export function getDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isPointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}