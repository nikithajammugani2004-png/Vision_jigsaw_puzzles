import { isPointInRect, getDistance } from "./utils.js";

export class PuzzlePiece {
  constructor(id, row, col, sx, sy, sWidth, sHeight) {
    this.id = id;
    this.row = row;
    this.col = col;

    // Image crop coordinates
    this.sx = sx;
    this.sy = sy;
    this.sWidth = sWidth;
    this.sHeight = sHeight;

    // Board / render metrics
    this.width = 0;
    this.height = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.currentX = 0;
    this.currentY = 0;

    this.isSnapped = false;
    this.isHovered = false;

    // Jigsaw edge tabs: 0: flat (border), 1: outer tab, -1: inner socket
    this.tabs = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };
  }

  draw(ctx, img) {
    ctx.save();

    // Subtle drop shadow for loose pieces
    if (!this.isSnapped) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
    }

    ctx.beginPath();
    this.createPath(ctx, this.currentX, this.currentY, this.width, this.height);

    ctx.save();
    ctx.clip();
    ctx.drawImage(
      img,
      this.sx,
      this.sy,
      this.sWidth,
      this.sHeight,
      this.currentX,
      this.currentY,
      this.width,
      this.height
    );
    ctx.restore();

    // Outline
    ctx.strokeStyle = this.isSnapped
      ? "rgba(56, 189, 248, 0.25)"
      : this.isHovered
      ? "#38bdf8"
      : "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = this.isHovered ? 2.5 : 1.5;
    ctx.stroke();

    ctx.restore();
  }

  createPath(ctx, x, y, w, h) {
    const tabW = w * 0.22;
    const tabH = h * 0.22;

    ctx.moveTo(x, y);

    // Top edge
    if (this.tabs.top !== 0) {
      const dir = this.tabs.top;
      ctx.lineTo(x + w * 0.38, y);
      ctx.bezierCurveTo(
        x + w * 0.32, y - tabH * dir,
        x + w * 0.42, y - tabH * dir * 1.3,
        x + w * 0.5, y - tabH * dir * 1.3
      );
      ctx.bezierCurveTo(
        x + w * 0.58, y - tabH * dir * 1.3,
        x + w * 0.68, y - tabH * dir,
        x + w * 0.62, y
      );
    }
    ctx.lineTo(x + w, y);

    // Right edge
    if (this.tabs.right !== 0) {
      const dir = this.tabs.right;
      ctx.lineTo(x + w, y + h * 0.38);
      ctx.bezierCurveTo(
        x + w + tabW * dir, y + h * 0.32,
        x + w + tabW * dir * 1.3, y + h * 0.42,
        x + w + tabW * dir * 1.3, y + h * 0.5
      );
      ctx.bezierCurveTo(
        x + w + tabW * dir * 1.3, y + h * 0.58,
        x + w + tabW * dir, y + h * 0.68,
        x + w, y + h * 0.62
      );
    }
    ctx.lineTo(x + w, y + h);

    // Bottom edge
    if (this.tabs.bottom !== 0) {
      const dir = this.tabs.bottom;
      ctx.lineTo(x + w * 0.62, y + h);
      ctx.bezierCurveTo(
        x + w * 0.68, y + h + tabH * dir,
        x + w * 0.58, y + h + tabH * dir * 1.3,
        x + w * 0.5, y + h + tabH * dir * 1.3
      );
      ctx.bezierCurveTo(
        x + w * 0.42, y + h + tabH * dir * 1.3,
        x + w * 0.32, y + h + tabH * dir,
        x + w * 0.38, y + h
      );
    }
    ctx.lineTo(x, y + h);

    // Left edge
    if (this.tabs.left !== 0) {
      const dir = this.tabs.left;
      ctx.lineTo(x, y + h * 0.62);
      ctx.bezierCurveTo(
        x - tabW * dir, y + h * 0.68,
        x - tabW * dir * 1.3, y + h * 0.58,
        x - tabW * dir * 1.3, y + h * 0.5
      );
      ctx.bezierCurveTo(
        x - tabW * dir * 1.3, y + h * 0.42,
        x - tabW * dir, y + h * 0.32,
        x, y + h * 0.38
      );
    }
    ctx.closePath();
  }
}

export class PuzzleEngine {
  constructor() {
    this.pieces = [];
    this.image = null;
    this.gridRows = 3;
    this.gridCols = 3;

    this.boardX = 0;
    this.boardY = 0;
    this.boardWidth = 0;
    this.boardHeight = 0;

    this.snapThreshold = 45; // Pixel tolerance to snap piece into place
    this.grabbedPiece = null;
    this.grabOffset = { x: 0, y: 0 };
  }

  setupPuzzle(image, level, canvasWidth, canvasHeight) {
    this.image = image;
    this.pieces = [];

    // Scale grid difficulty by level: Level 1 = 3x3, Level 2 = 4x4, etc.
    const size = Math.min(level + 2, 6);
    this.gridRows = size;
    this.gridCols = size;

    // Board dimensions
    this.boardWidth = Math.min(canvasWidth * 0.52, canvasHeight * 0.65);
    this.boardHeight = this.boardWidth;
    this.boardX = (canvasWidth - this.boardWidth) / 2;
    this.boardY = (canvasHeight - this.boardHeight) / 2;

    const pieceW = this.boardWidth / this.gridCols;
    const pieceH = this.boardHeight / this.gridRows;

    const cropW = image.naturalWidth / this.gridCols;
    const cropH = image.naturalHeight / this.gridRows;

    // Generate grid pieces
    let id = 0;
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const piece = new PuzzlePiece(
          id++,
          r,
          c,
          c * cropW,
          r * cropH,
          cropW,
          cropH
        );

        piece.width = pieceW;
        piece.height = pieceH;
        piece.targetX = this.boardX + c * pieceW;
        piece.targetY = this.boardY + r * pieceH;

        // Distribute loose pieces around the perimeter
        const leftZone = Math.random() < 0.5;
        const scatterX = leftZone
          ? Math.random() * Math.max(10, this.boardX - pieceW - 15)
          : this.boardX + this.boardWidth + 15 + Math.random() * Math.max(10, canvasWidth - (this.boardX + this.boardWidth + pieceW + 20));

        const scatterY = Math.random() * (canvasHeight - pieceH - 20) + 10;

        piece.currentX = Math.max(10, Math.min(canvasWidth - pieceW - 10, scatterX));
        piece.currentY = Math.max(10, Math.min(canvasHeight - pieceH - 10, scatterY));

        this.pieces.push(piece);
      }
    }

    // Build interlocking puzzle tabs
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const piece = this.getPieceByGrid(r, c);

        // Right / Left matching
        if (c < this.gridCols - 1) {
          const tab = Math.random() < 0.5 ? 1 : -1;
          piece.tabs.right = tab;
          const neighbor = this.getPieceByGrid(r, c + 1);
          if (neighbor) neighbor.tabs.left = -tab;
        }

        // Bottom / Top matching
        if (r < this.gridRows - 1) {
          const tab = Math.random() < 0.5 ? 1 : -1;
          piece.tabs.bottom = tab;
          const neighbor = this.getPieceByGrid(r + 1, c);
          if (neighbor) neighbor.tabs.top = -tab;
        }
      }
    }
  }

  getPieceByGrid(row, col) {
    return this.pieces.find((p) => p.row === row && p.col === col);
  }

  getPieceAt(x, y) {
    // Search top-to-bottom of render stack
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (
        !piece.isSnapped &&
        isPointInRect({ x, y }, {
          x: piece.currentX,
          y: piece.currentY,
          width: piece.width,
          height: piece.height
        })
      ) {
        return piece;
      }
    }
    return null;
  }

  updateInteraction(cursor) {
    if (!cursor) return;

    // Hover state
    for (const piece of this.pieces) {
      piece.isHovered =
        !piece.isSnapped &&
        isPointInRect(cursor, {
          x: piece.currentX,
          y: piece.currentY,
          width: piece.width,
          height: piece.height
        });
    }

    // Gesture grab logic
    if (cursor.isPinching) {
      if (!this.grabbedPiece) {
        const piece = this.getPieceAt(cursor.x, cursor.y);
        if (piece) {
          this.grabbedPiece = piece;
          this.grabOffset.x = cursor.x - piece.currentX;
          this.grabOffset.y = cursor.y - piece.currentY;

          // Lift to top of drawing order
          const idx = this.pieces.indexOf(piece);
          this.pieces.splice(idx, 1);
          this.pieces.push(piece);
        }
      } else {
        // Move with smoothed cursor
        this.grabbedPiece.currentX = cursor.x - this.grabOffset.x;
        this.grabbedPiece.currentY = cursor.y - this.grabOffset.y;
      }
    } else {
      // Release piece
      if (this.grabbedPiece) {
        this.checkSnap(this.grabbedPiece);
        this.grabbedPiece = null;
      }
    }
  }

  checkSnap(piece) {
    if (!piece || piece.isSnapped) return;

    const dist = getDistance(
      { x: piece.currentX, y: piece.currentY },
      { x: piece.targetX, y: piece.targetY }
    );

    if (dist <= this.snapThreshold) {
      piece.currentX = piece.targetX;
      piece.currentY = piece.targetY;
      piece.isSnapped = true;

      // Push snapped pieces beneath free pieces
      const idx = this.pieces.indexOf(piece);
      this.pieces.splice(idx, 1);
      this.pieces.unshift(piece);
    }
  }

  isComplete() {
    return this.pieces.length > 0 && this.pieces.every((p) => p.isSnapped);
  }

  drawBoard(ctx) {
    ctx.save();
    // Target grid outline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

    const pieceW = this.boardWidth / this.gridCols;
    const pieceH = this.boardHeight / this.gridRows;

    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        ctx.strokeRect(
          this.boardX + c * pieceW,
          this.boardY + r * pieceH,
          pieceW,
          pieceH
        );
      }
    }
    ctx.restore();
  }

  drawPieces(ctx) {
    if (!this.image) return;
    for (const piece of this.pieces) {
      piece.draw(ctx, this.image);
    }
  }
}