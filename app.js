/*
 * Main script for the web based chess game.
 *
 * Uses the chess.js library (loaded separately in index.html) to handle
 * the rules of chess, move generation, and game state such as checks
 * and checkmate.  This script focuses on rendering the board, handling
 * player interaction (clicking to select and move pieces) and updating
 * the display based on the current game state.  The interface is kept
 * colourful and inviting with highlighted moves and animated transitions.
 */

// Wait for the DOM to finish loading before interacting with elements.
document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const game = new Chess();

  let selectedSquare = null;
  let possibleMoves = [];

  /**
   * Convert a chess piece from chess.js (which has type and colour
   * properties) into a Unicode chess symbol.  This avoids having to
   * download or reference external images and keeps the interface tidy.
   *
   * @param {object} piece The piece object from chess.js
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
   * Render the entire board based on the current game state.  Each square
   * becomes a div with appropriate classes for colouring and highlighting.
   */
  function renderBoard() {
    // Clear existing squares
    boardContainer.innerHTML = '';

    // Get the board array from chess.js.  The array is 2D with
    // board[0][0] representing a8 and board[7][7] representing h1.
    const board = game.board();

    // Determine the square of the current player's king if they are in
    // check, used to highlight the square.
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
        // Light/dark colouring based on sum of indices
        squareEl.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');

        const file = 'abcdefgh'[col];
        const rank = 8 - row;
        const squareName = file + rank;
        squareEl.dataset.square = squareName;

        const piece = board[row][col];
        if (piece) {
          squareEl.textContent = getUnicodePiece(piece);
          // Assign colours to pieces.  White pieces are drawn in an off‑white
          // shade with a subtle shadow so they stand out on both light and
          // dark squares.  Black pieces are drawn in a dark shade.
          if (piece.color === 'w') {
            squareEl.style.color = '#fafafa';
            squareEl.style.textShadow = '0 0 2px #000';
          } else {
            squareEl.style.color = '#111111';
            squareEl.style.textShadow = '0 0 1px #fff';
          }
        }

        // Highlight if this square is the selected square
        if (selectedSquare === squareName) {
          squareEl.classList.add('selected');
        }
        // Highlight possible moves
        if (possibleMoves.includes(squareName)) {
          // If there's a piece on the square, it's a capture move
          if (piece && piece.color !== game.turn()) {
            squareEl.classList.add('capture');
          } else {
            squareEl.classList.add('move');
          }
        }

        // Highlight the square where the current player's king is in check
        if (checkSquare && checkSquare === squareName) {
          squareEl.classList.add('check');
        }

        // Attach click handler
        squareEl.addEventListener('click', onSquareClick);
        boardContainer.appendChild(squareEl);
      }
    }
    updateStatus();
  }

  /**
   * Event handler for clicks on a square.  This function manages
   * selecting pieces, highlighting legal moves, and performing moves.
   *
   * @param {MouseEvent} event The click event
   */
  function onSquareClick(event) {
    const square = event.currentTarget.dataset.square;
    const piece = game.get(square);

    // If a move is available and the clicked square is in the list of
    // possible moves, perform the move and deselect
    if (selectedSquare && possibleMoves.includes(square)) {
      game.move({ from: selectedSquare, to: square });
      selectedSquare = null;
      possibleMoves = [];
      renderBoard();
      return;
    }

    // If the clicked square contains a piece of the player whose turn it is,
    // select that square and compute legal moves
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      const moves = game.moves({ square: square, verbose: true });
      possibleMoves = moves.map(move => move.to);
      renderBoard();
    } else {
      // Otherwise, clear selection
      selectedSquare = null;
      possibleMoves = [];
      renderBoard();
    }
  }

  /**
   * Update the status display with whose turn it is and whether the
   * current side is in check, checkmate or draw.
   */
  function updateStatus() {
    let status = '';
    const moveColor = game.turn() === 'w' ? 'White' : 'Black';
    if (game.in_checkmate()) {
      status = `Game over: ${moveColor} is in checkmate.`;
    } else if (game.in_draw()) {
      status = 'Game over: draw.';
    } else {
      status = `${moveColor} to move.`;
      if (game.in_check()) {
        status += ' (Check!)';
      }
    }
    statusEl.textContent = status;
  }

  // Initial render
  renderBoard();
});
