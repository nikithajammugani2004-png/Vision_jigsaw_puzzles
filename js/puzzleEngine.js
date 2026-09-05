import { isPointInRect, getDistance } from "./utils.js";

export class PuzzlePiece {
  constructor(id, row, col, sourceX, sourceY, pieceWidth, pieceHeight, targetX, targetY, edges) {
    this.id = id;
    this.row = row;
    this.col = col;
    this.sourceX = sourceX;
    this.sourceY = sourceY;
    this.width = pieceWidth;
    this.height = pieceHeight;
    this.targetX = targetX;
    this.targetY = targetY;
    this.edges = edges; // { top, right, bottom, left } -> 0: flat, 1: tab out, -1: blank in

    this.currentX = 0;
    this.currentY = 0;
    this.isSnapped = false;
    this.isDragging = false;
    this.tabSize = Math.min(pieceWidth, pieceHeight) * 0.22;
  }

  buildPath(ctx, originX, originY) {
    const w = this.width;
    const h = this.height;
    const t = this.tabSize;

    ctx.beginPath();
    ctx.moveTo(originX, originY);

    // Top edge
    if (this.edges.top === 0) {
      ctx.lineTo(originX + w, originY);
    } else {
      const dir = this.edges.top; // 1 = up, -1 = down
      ctx.lineTo(originX + w * 0.35, originY);
      ctx.bezierCurveTo(
        originX + w * 0.35, originY - t * dir,
        originX + w * 0.65, originY - t * dir,
        originX + w * 0.65, originY
      );
      ctx.lineTo(originX + w, originY);
    }

    // Right edge
    if (this.edges.right === 0) {
      ctx.lineTo(originX + w, originY + h);
    } else {
      const dir = this.edges.right; // 1 = right, -1 = left
      ctx.lineTo(originX + w, originY + h * 0.35);
      ctx.bezierCurveTo(
        originX + w + t * dir, originY + h * 0.35,
        originX + w + t * dir, originY + h * 0.65,
        originX + w, originY + h * 0.65
      );
      ctx.lineTo(originX + w, originY + h);
    }

    // Bottom edge
    if (this.edges.bottom === 0) {
      ctx.lineTo(originX, originY + h);
    } else {
      const dir = this.edges.bottom; // 1 = down, -1 = up
      ctx.lineTo(originX + w * 0.65, originY + h);
      ctx.bezierCurveTo(
        originX + w * 0.65, originY + h + t * dir,
        originX + w * 0.35, originY + h + t * dir,
        originX + w * 0.35, originY + h
      );
      ctx.lineTo(originX, originY + h);
    }

    // Left edge
    if (this.edges.left === 0) {
      ctx.closePath();
    } else {
      const dir = this.edges.left; // 1 = left, -1 = right
      ctx.lineTo(originX, originY + h * 0.65);
      ctx.bezierCurveTo(
        originX - t * dir, originY + h * 0.65,
        originX - t * dir, originY + h * 0.35,
        originX, originY + h * 0.35
      );
      ctx.closePath();
    }
  }

  draw(ctx, image) {
    if (!image || !image.complete || image.naturalWidth === 0) return;

    ctx.save();

    // 1. Clip using interlocking jigsaw contour
    this.buildPath(ctx, this.currentX, this.currentY);
    ctx.save();
    ctx.clip();

    // 2. Map coordinates with tab padding
    const pad = this.tabSize * 1.5;
    const ratioX = image.width / (this.width * 4);
    const ratioY = image.height / (this.height * 4);

    const sx = Math.max(0, this.sourceX - pad * ratioX);
    const sy = Math.max(0, this.sourceY - pad * ratioY);
    const sw = Math.min(image.width - sx, this.width * ratioX + pad * 2 * ratioX);
    const sh = Math.min(image.height - sy, this.height * ratioY + pad * 2 * ratioY);

    ctx.drawImage(
      image,
      sx, sy, sw, sh,
      this.currentX - pad, this.currentY - pad,
      this.width + pad * 2, this.height + pad * 2
    );
    ctx.restore();

    // 3. Stroke outer edge
    this.buildPath(ctx, this.currentX, this.currentY);
    ctx.lineWidth = 2;
    if (this.isSnapped) {
      ctx.strokeStyle = "#4ade80";
      ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 6;
    } else if (this.isDragging) {
      ctx.strokeStyle = "#38bdf8";
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 12;
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.shadowColor = "transparent";
    }
    ctx.stroke();

    ctx.restore();
  }
}

export class PuzzleEngine {
  constructor() {
    this.pieces = [];
    this.gridCols = 4;
    this.gridRows = 4;
    this.boardWidth = 380;
    this.boardHeight = 380;
    this.boardX = 0;
    this.boardY = 0;
    this.activePiece = null;
    this.snapThreshold = 45;
  }

  computeGridForLevel(level) {
    if (level === 1) return { cols: 4, rows: 4 }; // 16 pieces
    if (level === 2) return { cols: 5, rows: 4 }; // 20 pieces
    if (level === 3) return { cols: 5, rows: 5 }; // 25 pieces
    if (level === 4) return { cols: 6, rows: 5 }; // 30 pieces
    return { cols: 6, rows: 6 };                  // 36 pieces
  }

  setupPuzzle(image, level, screenWidth, screenHeight) {
    this.pieces = [];
    this.activePiece = null;

    const { cols, rows } = this.computeGridForLevel(level);
    this.gridCols = cols;
    this.gridRows = rows;

    this.boardX = (screenWidth - this.boardWidth) / 2;
    this.boardY = (screenHeight - this.boardHeight) / 2 - 10;

    const pieceWidth = this.boardWidth / cols;
    const pieceHeight = this.boardHeight / rows;
    const imgPieceW = image.width / cols;
    const imgPieceH = image.height / rows;
    const horizontalEdges = Array.from({ length: rows }, () => Array(cols).fill(0));
    const verticalEdges = Array.from({ length: rows }, () => Array(cols).fill(0));

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const targetX = this.boardX + c * pieceWidth;
        const targetY = this.boardY + r * pieceHeight;
        const sourceX = c * imgPieceW;
        const sourceY = r * imgPieceH;

        // Assign complementary interlocking tabs
        const edges = {
          top: r === 0 ? 0 : -horizontalEdges[r - 1][c],
          bottom: r === rows - 1 ? 0 : (Math.random() < 0.5 ? 1 : -1),
          left: c === 0 ? 0 : -verticalEdges[r][c - 1],
          right: c === cols - 1 ? 0 : (Math.random() < 0.5 ? 1 : -1)
        };

        if (r < rows - 1) horizontalEdges[r][c] = edges.bottom;
        if (c < cols - 1) verticalEdges[r][c] = edges.right;

        const piece = new PuzzlePiece(
          id++,
          r,
          c,
          sourceX,
          sourceY,
          pieceWidth,
          pieceHeight,
          targetX,
          targetY,
          edges
        );

        const scatterLeft = Math.random() < 0.5;
        const spawnX = scatterLeft
          ? Math.random() * (this.boardX - pieceWidth - 40) + 20
          : Math.random() * (screenWidth - (this.boardX + this.boardWidth + pieceWidth) - 40) + (this.boardX + this.boardWidth + 20);

        const spawnY = Math.random() * (screenHeight - pieceHeight - 160) + 120;

        piece.currentX = Math.max(10, spawnX);
        piece.currentY = Math.max(80, spawnY);

        this.pieces.push(piece);
      }
    }
  }

  drawBoardArea(ctx) {
    ctx.save();

    // Dark backdrop for the puzzle assembly area
    ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
    ctx.fillRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

    // Draw the jigsaw slots for each tile with interlocking tab outlines
    for (const piece of this.pieces) {
      piece.buildPath(ctx, piece.targetX, piece.targetY);
      
      // Empty slot styling
      if (!piece.isSnapped) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.fill();
      } else {
        // Subtle outline for completed slots
        ctx.strokeStyle = "rgba(74, 222, 128, 0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Outer framing border
    ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
    ctx.lineWidth = 3;
    ctx.strokeRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

    ctx.restore();
  }
  
  handlePointerDown(x, y) {
    const padding = 20; // 20px hit-tolerance padding around each piece
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (
        !piece.isSnapped &&
        isPointInRect(
          x,
          y,
          piece.currentX - padding,
          piece.currentY - padding,
          piece.width + padding * 2,
          piece.height + padding * 2
        )
      ) {
        this.activePiece = piece;
        piece.isDragging = true;
        this.pieces.splice(i, 1);
        this.pieces.push(piece);
        break;
      }
    }
  }

  handlePointerMove(x, y) {
    if (this.activePiece && this.activePiece.isDragging) {
      this.activePiece.currentX = x - this.activePiece.width / 2;
      this.activePiece.currentY = y - this.activePiece.height / 2;
    }
  }

  handlePointerUp() {
    if (!this.activePiece) return false;

    const piece = this.activePiece;
    piece.isDragging = false;

    const dist = getDistance(
      { x: piece.currentX, y: piece.currentY },
      { x: piece.targetX, y: piece.targetY }
    );

    let snapped = false;
    if (dist < this.snapThreshold) {
      piece.currentX = piece.targetX;
      piece.currentY = piece.targetY;
      piece.isSnapped = true;
      snapped = true;
    }

    this.activePiece = null;
    return snapped;
  }

  isLevelComplete() {
    return this.pieces.length > 0 && this.pieces.every((p) => p.isSnapped);
  }

  getRemainingCount() {
    return this.pieces.filter((p) => !p.isSnapped).length;
  }
}