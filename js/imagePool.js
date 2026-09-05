// Function returning a random high-res image URL with a unique cache-buster timestamp
export function getRandomPuzzleImage() {
  const randomSeed = Math.floor(Math.random() * 1000);
  return `https://picsum.photos/seed/${randomSeed}/800/800`;
}

// Fallback pool if needed
export const puzzleImages = [
  "https://picsum.photos/seed/puzzle1/800/800",
  "https://picsum.photos/seed/puzzle2/800/800",
  "https://picsum.photos/seed/puzzle3/800/800"
];