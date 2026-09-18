// Function returning a random high-res image URL with a unique seed to avoid caching
export function getRandomPuzzleImage() {
  const randomSeed = Math.floor(Math.random() * 10000);
  return `https://picsum.photos/seed/${randomSeed}/800/800`;
}

// Fallback pool of high-res CORS-friendly images
export const puzzleImages = [
  "https://picsum.photos/seed/puzzle1/800/800",
  "https://picsum.photos/seed/puzzle2/800/800",
  "https://picsum.photos/seed/puzzle3/800/800",
  "https://picsum.photos/seed/puzzle4/800/800",
  "https://picsum.photos/seed/puzzle5/800/800"
];

// Procedural fallback pattern in case external network image request is blocked or slow
export function createFallbackPuzzlePattern(level = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 800, 800);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(0.5, "#3b0764");
  grad.addColorStop(1, "#0369a1");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 800);

  const colors = ["#38bdf8", "#ec4899", "#a855f7", "#22c55e", "#f59e0b"];
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    const x = (i * 137) % 800;
    const y = (i * 211) % 800;
    const r = 30 + (i * 17) % 70;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length] + "44";
    ctx.fill();
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VISION JIGSAW", 400, 390);
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(`LEVEL ${level} PUZZLE CHALLENGE`, 400, 430);

  return canvas.toDataURL("image/png");
}