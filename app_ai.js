/*
 * AI‑enhanced version of the chess game.
 *
 * This script extends the original web chess game by adding a simple
 * computer opponent.  When the page loads the human and AI are
 * randomly assigned colours (white or black).  The AI chooses
 * random legal moves, waits briefly before moving and animates
 * its piece from the source to the destination square.  The rules
 * of chess and move legality are handled by the chess.js library.
 */

document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const game = new Chess();

  // Randomly assign the human and AI colours.  'w' denotes white and
  // 'b' denotes black.  The human plays playerColor and the AI
  // automatically plays the opposite colour.
  let playerColor = Math.random() < 0.5 ? 'w' : 'b';
  let aiColor = playerColor === 'w' ? 'b' : 'w';
  // Flag to indicate when the AI is thinking or animating a move.
  let aiThinking = false;

  let selectedSquare = null;
  let possibleMoves = [];

  /**
   * Convert a chess piece object from chess.js into a Unicode symbol
   * for display on the board.  This lookup avoids the need for
   * external graphics and keeps the interface lightweight.
   *
   * @param {object} piece The piece object with type and colour
   * @returns {string} A Unicode character representing the piece
   */
  function getUnicodePiece(piece) {
    const lookup = {
      p: { w: '♙', b: '♟' },
      r: { w: '♖', b: '♜' },
      n: { w: '♘', b: '♞' },
      b: { w: '♗', b: '♝' },
      q: { w: '♕', b: '♛' },
      k: { w: '♔', b: '♚' },
    };
    return lookup[piece.type][piece.color];
  }

  /**
   * Render the entire board from the current game state.  Each square
   * becomes a div with classes controlling colour and highlighting.
   */
  function renderBoard() {
    boardContainer.innerHTML = '';
    const board = game.board();
    // Determine if the current player's king is in check so we can
    // highlight the square.
    let checkSquare = null;
    if (game.in_check()) {
      const turn = game.turn();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === turn) {
            const file = 'abcdefgh'[c];
            const rank = 8 - r;
            checkSquare = file + rank;
            break;
          }
        }
        if (checkSquare) break;
      }
    }

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const squareEl = document.createElement('div');
        squareEl.classList.add('square');
        squareEl.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
        const file = 'abcdefgh'[col];
        const rank = 8 - row;
        const squareName = file + rank;
        squareEl.dataset.square = squareName;
        const piece = board[row][col];
        if (piece) {
          squareEl.textContent = getUnicodePiece(piece);
          // Apply colours so pieces stand out against both light and dark
          // squares.  White pieces use an off‑white colour with a dark
          // shadow, while black pieces use a dark colour with a light
          // shadow.
          if (piece.color === 'w') {
            squareEl.style.color = '#fafafa';
            squareEl.style.textShadow = '0 0 2px #000';
          } else {
            squareEl.style.color = '#111111';
            squareEl.style.textShadow = '0 0 1px #fff';
          }
        }
        if (selectedSquare === squareName) {
          squareEl.classList.add('selected');
        }
        if (possibleMoves.includes(squareName)) {
          if (piece && piece.color !== game.turn()) {
            squareEl.classList.add('capture');
          } else {
            squareEl.classList.add('move');
          }
        }
        if (checkSquare && checkSquare === squareName) {
          squareEl.classList.add('check');
        }
        squareEl.addEventListener('click', onSquareClick);
        boardContainer.appendChild(squareEl);
      }
    }
    updateStatus();
  }

  /**
   * Handle clicks on squares for selecting pieces and executing moves.
   * Disables interaction when it's not the human's turn or while the
   * AI is making its move.
   *
   * @param {MouseEvent} event The click event
   */
  function onSquareClick(event) {
    if (aiThinking || game.turn() !== playerColor) return;
    const square = event.currentTarget.dataset.square;
    const piece = game.get(square);
    if (selectedSquare && possibleMoves.includes(square)) {
      game.move({ from: selectedSquare, to: square });
      selectedSquare = null;
      possibleMoves = [];
      renderBoard();
      // After the human moves, trigger the AI response.
      triggerAiMove();
      return;
    }
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      const moves = game.moves({ square: square, verbose: true });
      possibleMoves = moves.map(move => move.to);
      renderBoard();
    } else {
      selectedSquare = null;
      possibleMoves = [];
      renderBoard();
    }
  }

  /**
   * Update the status text to show which side the human is playing,
   * whose turn it is, and whether the game has ended.
   */
  function updateStatus() {
    let status = '';
    const humanColorName = playerColor === 'w' ? 'White' : 'Black';
    status += `You are playing ${humanColorName}.\n`;
    const moveColor = game.turn() === 'w' ? 'White' : 'Black';
    if (game.in_checkmate()) {
      status += `Game over: ${moveColor} is in checkmate.`;
    } else if (game.in_draw()) {
      status += 'Game over: draw.';
    } else {
      status += `${moveColor} to move.`;
      if (game.in_check()) {
        status += ' (Check!)';
      }
    }
    statusEl.innerHTML = status.replace(/\n/g, '<br>');
  }

  /**
   * Animate the AI's chosen move by moving a copy of the piece across
   * the board from the source square to the destination square.  When
   * the animation completes, the callback is invoked so the move can
   * be applied to the game state and the board re‑rendered.
   *
   * @param {object} move The move object returned by chess.js
   * @param {Function} callback Called after the animation completes
   */
  function animateAIMove(move, callback) {
    const fromSquare = move.from;
    const toSquare = move.to;
    const piece = game.get(fromSquare);
    // If there is no piece on the from square (unlikely), skip animation.
    if (!piece) {
      callback();
      return;
    }
    const squares = Array.from(boardContainer.children);
    const fromEl = squares.find(el => el.dataset.square === fromSquare);
    const toEl = squares.find(el => el.dataset.square === toSquare);
    if (!fromEl || !toEl) {
      callback();
      return;
    }
    const boardRect = boardContainer.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const movingPiece = document.createElement('div');
    movingPiece.textContent = getUnicodePiece(piece);
    movingPiece.classList.add('anim-piece');
    // Use the same colours as the piece on the board
    if (piece.color === 'w') {
      movingPiece.style.color = '#fafafa';
      movingPiece.style.textShadow = '0 0 2px #000';
    } else {
      movingPiece.style.color = '#111111';
      movingPiece.style.textShadow = '0 0 1px #fff';
    }
    // Determine the size of a square and the piece for centering
    const squareSize = fromEl.clientWidth;
    // Use computed font size of the moving piece (will be 42px as per CSS)
    // so we can center it within the square.
    const pieceSize = parseFloat(window.getComputedStyle(fromEl).fontSize);
    // Position the moving piece at the centre of the from square relative to the board
    movingPiece.style.left = (fromRect.left - boardRect.left + squareSize / 2 - pieceSize / 2) + 'px';
    movingPiece.style.top = (fromRect.top - boardRect.top + squareSize / 2 - pieceSize / 2) + 'px';
    boardContainer.appendChild(movingPiece);
    // Hide the piece on the from square during animation
    fromEl.textContent = '';
    // Trigger the CSS transition to move the piece to its destination
    requestAnimationFrame(() => {
      movingPiece.style.left = (toRect.left - boardRect.left + squareSize / 2 - pieceSize / 2) + 'px';
      movingPiece.style.top = (toRect.top - boardRect.top + squareSize / 2 - pieceSize / 2) + 'px';
    });
    // After the transition duration, clean up and call the callback
    setTimeout(() => {
      boardContainer.removeChild(movingPiece);
      callback();
    }, 550);
  }

  /**
   * After the human moves, schedule the AI's move.  The AI picks a
   * random legal move from chess.js, highlights the move, animates
   * it and then applies it to the game state.
   */
  function triggerAiMove() {
    if (game.turn() !== aiColor || game.game_over()) return;
    aiThinking = true;
    setTimeout(() => {
      const legalMoves = game.moves({ verbose: true });
      if (legalMoves.length === 0) {
        aiThinking = false;
        return;
      }
      const move = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      selectedSquare = move.from;
      possibleMoves = [move.to];
      renderBoard();
      animateAIMove(move, () => {
        game.move({ from: move.from, to: move.to, promotion: move.promotion });
        selectedSquare = null;
        possibleMoves = [];
        aiThinking = false;
        renderBoard();
      });
    }, 400);
  }

  // Initial draw of the board
  renderBoard();
  // If the AI is playing white, let it move first
  if (aiColor === 'w') {
    triggerAiMove();
  }
});
