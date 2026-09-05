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