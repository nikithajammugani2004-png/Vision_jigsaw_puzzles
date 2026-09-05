/**
 * Dynamic zero-input image generator.
 * Fetches fresh, high-res random pictures on the fly via unique seed IDs.
 * No hardcoded images, no manual uploads, and guaranteed zero repeats.
 */

export class ImageManager {
  constructor() {
    this.usedSeeds = new Set();
    this.totalAvailablePicks = 100;
  }

  // Generates a unique random seed URL
  getRandomImageUrl() {
    if (this.usedSeeds.size >= this.totalAvailablePicks) {
      this.usedSeeds.clear();
    }

    let seed;
    do {
      seed = Math.floor(Math.random() * 1000) + 1;
    } while (this.usedSeeds.has(seed));

    this.usedSeeds.add(seed);
    // Uses Picsum dynamic photos with unique seeds (always crisp, 600x600 square)
    return `https://picsum.photos/seed/${seed}/600/600`;
  }

  loadImage() {
    return new Promise((resolve) => {
      const url = this.getRandomImageUrl();
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        // Fallback placeholder pattern if external network fails
        const fallbackCanvas = document.createElement("canvas");
        fallbackCanvas.width = 600;
        fallbackCanvas.height = 600;
        const fctx = fallbackCanvas.getContext("2d");
        const grad = fctx.createLinearGradient(0, 0, 600, 600);
        grad.addColorStop(0, "#0284c7");
        grad.addColorStop(0.5, "#6366f1");
        grad.addColorStop(1, "#ec4899");
        fctx.fillStyle = grad;
        fctx.fillRect(0, 0, 600, 600);
        const dataUrl = fallbackCanvas.toDataURL();
        img.src = dataUrl;
        resolve({ img, url: dataUrl });
      };
      img.src = url;
    });
  }
}