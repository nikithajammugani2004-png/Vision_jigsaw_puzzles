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

    // 0: flat, 1: tab outwards, -1: tab inwards
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
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
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

    ctx.strokeStyle = this.isSnapped
      ? "rgba(56, 189, 248, 0.4)"
      : this.isHovered
      ? "#38bdf8"
      : "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = this.isHovered ? 2.5 : 1.5;
    ctx.stroke();

    ctx.restore();
  }

  createPath(ctx, x, y, w, h) {
    const tabRadius = Math.min(w, h) * 0.18;

    ctx.moveTo(x, y);

    // Top
    if (this.tabs.top !== 0) {
      const sign = -this.tabs.top;
      ctx.lineTo(x + w * 0.38, y);
      ctx.bezierCurveTo(
        x + w * 0.36, y + tabRadius * sign * 0.4,
        x + w * 0.42, y + tabRadius * sign * 1.25,
        x + w * 0.5, y + tabRadius * sign * 1.25
      );
      ctx.bezierCurveTo(
        x + w * 0.58, y + tabRadius * sign * 1.25,
        x + w * 0.64, y + tabRadius * sign * 0.4,
        x + w * 0.62, y
      );
    }
    ctx.lineTo(x + w, y);

    // Right
    if (this.tabs.right !== 0) {
      const sign = this.tabs.right;
      ctx.lineTo(x + w, y + h * 0.38);
      ctx.bezierCurveTo(
        x + w + tabRadius * sign * 0.4, y + h * 0.36,
        x + w + tabRadius * sign * 1.25, y + h * 0.42,
        x + w + tabRadius * sign * 1.25, y + h * 0.5
      );
      ctx.bezierCurveTo(
        x + w + tabRadius * sign * 1.25, y + h * 0.58,
        x + w + tabRadius * sign * 0.4, y + h * 0.64,
        x + w, y + h * 0.62
      );
    }
    ctx.lineTo(x + w, y + h);

    // Bottom
    if (this.tabs.bottom !== 0) {
      const sign = this.tabs.bottom;
      ctx.lineTo(x + w * 0.62, y + h);
      ctx.bezierCurveTo(
        x + w * 0.64, y + h + tabRadius * sign * 0.4,
        x + w * 0.58, y + h + tabRadius * sign * 1.25,
        x + w * 0.5, y + h + tabRadius * sign * 1.25
      );
      ctx.bezierCurveTo(
        x + w * 0.42, y + h + tabRadius * sign * 1.25,
        x + w * 0.36, y + h + tabRadius * sign * 0.4,
        x + w * 0.38, y + h
      );
    }
    ctx.lineTo(x, y + h);

    // Left
    if (this.tabs.left !== 0) {
      const sign = -this.tabs.left;
      ctx.lineTo(x, y + h * 0.62);
      ctx.bezierCurveTo(
        x + tabRadius * sign * 0.4, y + h * 0.64,
        x + tabRadius * sign * 1.25, y + h * 0.58,
        x + tabRadius * sign * 1.25, y + h * 0.5
      );
      ctx.bezierCurveTo(
        x + tabRadius * sign * 1.25, y + h * 0.42,
        x + tabRadius * sign * 0.4, y + h * 0.36,
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
    this.gridRows = 4;
    this.gridCols = 4;

    this.boardX = 0;
    this.boardY = 0;
    this.boardWidth = 0;
    this.boardHeight = 0;

    this.snapThreshold = 45;
    this.grabbedPiece = null;
    this.grabOffset = { x: 0, y: 0 };
  }

  setupPuzzle(image, level, canvasWidth, canvasHeight) {
    this.image = image;
    this.pieces = [];

    // 4x4 grid (16 pieces) matches the video
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

        // Scatter pieces left and right outside the central board
        const placeLeft = Math.random() < 0.5;
        const scatterX = placeLeft
          ? Math.random() * Math.max(20, this.boardX - pieceW - 40) + 15
          : this.boardX + this.boardWidth + 40 + Math.random() * Math.max(20, canvasWidth - (this.boardX + this.boardWidth + pieceW + 60));

        const scatterY = Math.random() * (canvasHeight - pieceH - 60) + 30;

        piece.currentX = Math.max(10, Math.min(canvasWidth - pieceW - 10, scatterX));
        piece.currentY = Math.max(10, Math.min(canvasHeight - pieceH - 10, scatterY));

        this.pieces.push(piece);
      }
    }

    // Build interlocking matching tabs
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

    if (cursor.isPinching) {
      if (!this.grabbedPiece) {
        const piece = this.getPieceAt(cursor.x, cursor.y);
        if (piece) {
          this.grabbedPiece = piece;
          this.grabOffset.x = cursor.x - piece.currentX;
          this.grabOffset.y = cursor.y - piece.currentY;

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

    // Outer cyan glowing border
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

    // Inner jigsaw puzzle outline slots
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
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