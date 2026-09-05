import { isPointInRect, getDistance } from "./utils.js";

export class PuzzlePiece {
  constructor(id, row, col, sx, sy, sWidth, sHeight) {
    this.id = id;
    this.row = row;
    this.col = col;

    this.sx = sx;
    this.sy = sy;
    this.sWidth = sWidth;
    this.sHeight = sHeight;

    this.width = 0;
    this.height = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.currentX = 0;
    this.currentY = 0;

    this.isSnapped = false;
    this.isHovered = false;

    // 0: flat border, 1: outward tab, -1: inward socket
    this.tabs = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };
  }

  draw(ctx, img) {
    ctx.save();

    if (!this.isSnapped) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = this.isHovered ? 18 : 10;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
    }

    ctx.beginPath();
    this.createPath(ctx, this.currentX, this.currentY, this.width, this.height);

    ctx.save();
    ctx.clip();

    // Bleed drawing so outward tabs receive proper texture margins
    const bleed = Math.max(this.width, this.height) * 0.3;
    const sBleedX = (bleed / this.width) * this.sWidth;
    const sBleedY = (bleed / this.height) * this.sHeight;

    ctx.drawImage(
      img,
      Math.max(0, this.sx - sBleedX),
      Math.max(0, this.sy - sBleedY),
      Math.min(img.naturalWidth - this.sx + sBleedX, this.sWidth + sBleedX * 2),
      Math.min(img.naturalHeight - this.sy + sBleedY, this.sHeight + sBleedY * 2),
      this.currentX - bleed,
      this.currentY - bleed,
      this.width + bleed * 2,
      this.height + bleed * 2
    );
    ctx.restore();

    ctx.strokeStyle = this.isSnapped
      ? "rgba(56, 189, 248, 0.35)"
      : this.isHovered
      ? "#38bdf8"
      : "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = this.isHovered ? 2.5 : 1.5;
    ctx.stroke();

    ctx.restore();
  }

  createPath(ctx, x, y, w, h) {
    const tabSize = Math.min(w, h) * 0.22;

    ctx.moveTo(x, y);

    // Top Edge
    if (this.tabs.top !== 0) {
      const dir = this.tabs.top;
      ctx.lineTo(x + w * 0.38, y);
      ctx.bezierCurveTo(
        x + w * 0.36, y - tabSize * dir * 0.2,
        x + w * 0.32, y - tabSize * dir * 1.1,
        x + w * 0.5,  y - tabSize * dir * 1.1
      );
      ctx.bezierCurveTo(
        x + w * 0.68, y - tabSize * dir * 1.1,
        x + w * 0.64, y - tabSize * dir * 0.2,
        x + w * 0.62, y
      );
    }
    ctx.lineTo(x + w, y);

    // Right Edge
    if (this.tabs.right !== 0) {
      const dir = this.tabs.right;
      ctx.lineTo(x + w, y + h * 0.38);
      ctx.bezierCurveTo(
        x + w + tabSize * dir * 0.2, y + h * 0.36,
        x + w + tabSize * dir * 1.1, y + h * 0.32,
        x + w + tabSize * dir * 1.1, y + h * 0.5
      );
      ctx.bezierCurveTo(
        x + w + tabSize * dir * 1.1, y + h * 0.68,
        x + w + tabSize * dir * 0.2, y + h * 0.64,
        x + w,                       y + h * 0.62
      );
    }
    ctx.lineTo(x + w, y + h);

    // Bottom Edge
    if (this.tabs.bottom !== 0) {
      const dir = this.tabs.bottom;
      ctx.lineTo(x + w * 0.62, y + h);
      ctx.bezierCurveTo(
        x + w * 0.64, y + h + tabSize * dir * 0.2,
        x + w * 0.68, y + h + tabSize * dir * 1.1,
        x + w * 0.5,  y + h + tabSize * dir * 1.1
      );
      ctx.bezierCurveTo(
        x + w * 0.32, y + h + tabSize * dir * 1.1,
        x + w * 0.36, y + h + tabSize * dir * 0.2,
        x + w * 0.38, y + h
      );
    }
    ctx.lineTo(x, y + h);

    // Left Edge
    if (this.tabs.left !== 0) {
      const dir = this.tabs.left;
      ctx.lineTo(x, y + h * 0.62);
      ctx.bezierCurveTo(
        x - tabSize * dir * 0.2, y + h * 0.64,
        x - tabSize * dir * 1.1, y + h * 0.68,
        x - tabSize * dir * 1.1, y + h * 0.5
      );
      ctx.bezierCurveTo(
        x - tabSize * dir * 1.1, y + h * 0.32,
        x - tabSize * dir * 0.2, y + h * 0.36,
        x,                       y + h * 0.38
      );
    }
    ctx.closePath();
  }
}

export class PuzzleEngine {
  constructor() {
    this.pieces = [];
    this.image = null;
    this.gridRows = 4;
    this.gridCols = 4;

    this.boardX = 0;
    this.boardY = 0;
    this.boardWidth = 0;
    this.boardHeight = 0;

    this.snapThreshold = 55; // Generous snap tolerance
    this.grabbedPiece = null;
    this.grabOffset = { x: 0, y: 0 };
  }

  setupPuzzle(image, level, canvasWidth, canvasHeight) {
    this.image = image;
    this.pieces = [];

    this.gridRows = 4;
    this.gridCols = 4;

    this.boardWidth = Math.min(canvasWidth * 0.44, canvasHeight * 0.68);
    this.boardHeight = this.boardWidth;
    this.boardX = (canvasWidth - this.boardWidth) / 2;
    this.boardY = (canvasHeight - this.boardHeight) / 2;

    const pieceW = this.boardWidth / this.gridCols;
    const pieceH = this.boardHeight / this.gridRows;

    const cropW = image.naturalWidth / this.gridCols;
    const cropH = image.naturalHeight / this.gridRows;

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

        // Spread loose pieces nicely around the lateral margins
        const placeLeft = Math.random() < 0.5;
        const scatterX = placeLeft
          ? Math.random() * Math.max(20, this.boardX - pieceW - 40) + 15
          : this.boardX + this.boardWidth + 35 + Math.random() * Math.max(20, canvasWidth - (this.boardX + this.boardWidth + pieceW + 60));

        const scatterY = Math.random() * (canvasHeight - pieceH - 60) + 30;

        piece.currentX = Math.max(10, Math.min(canvasWidth - pieceW - 10, scatterX));
        piece.currentY = Math.max(10, Math.min(canvasHeight - pieceH - 10, scatterY));

        this.pieces.push(piece);
      }
    }

    // Interlocking tabs matching
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const piece = this.getPieceByGrid(r, c);

        if (c < this.gridCols - 1) {
          const tab = Math.random() < 0.5 ? 1 : -1;
          piece.tabs.right = tab;
          const neighbor = this.getPieceByGrid(r, c + 1);
          if (neighbor) neighbor.tabs.left = -tab;
        }

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
    // Top-to-bottom priority check with generous hit box covering tabs
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (
        !piece.isSnapped &&
        isPointInRect({ x, y }, {
          x: piece.currentX - piece.width * 0.25,
          y: piece.currentY - piece.height * 0.25,
          width: piece.width * 1.5,
          height: piece.height * 1.5
        })
      ) {
        return piece;
      }
    }
    return null;
  }

  updateInteraction(cursor) {
    if (!cursor) return;

    // Hover indicators
    for (const piece of this.pieces) {
      piece.isHovered =
        !piece.isSnapped &&
        isPointInRect(cursor, {
          x: piece.currentX - piece.width * 0.15,
          y: piece.currentY - piece.height * 0.15,
          width: piece.width * 1.3,
          height: piece.height * 1.3
        });
    }

    // Pinch pickup
    if (cursor.isPinching) {
      if (!this.grabbedPiece) {
        const piece = this.getPieceAt(cursor.x, cursor.y);
        if (piece) {
          this.grabbedPiece = piece;
          this.grabOffset.x = cursor.x - piece.currentX;
          this.grabOffset.y = cursor.y - piece.currentY;

          // Lift grabbed piece immediately to top of rendering order
          const idx = this.pieces.indexOf(piece);
          this.pieces.splice(idx, 1);
          this.pieces.push(piece);
        }
      } else {
        this.grabbedPiece.currentX = cursor.x - this.grabOffset.x;
        this.grabbedPiece.currentY = cursor.y - this.grabOffset.y;
      }
    } else {
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

      // Lock snapped piece behind any movable pieces
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

    // Outer cyan grid border
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

    // Inner jigsaw puzzle outline slots
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.2;

    for (const piece of this.pieces) {
      ctx.beginPath();
      piece.createPath(ctx, piece.targetX, piece.targetY, piece.width, piece.height);
      ctx.stroke();
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