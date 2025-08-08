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
  const moveListEl = document.getElementById('move-list');
  const game = new Chess();

  // Randomly assign the human and AI colours.  'w' denotes white and
  // 'b' denotes black.  The human plays playerColor and the AI
  // automatically plays the opposite colour.
  let playerColor = Math.random() < 0.5 ? 'w' : 'b';
  let aiColor = playerColor === 'w' ? 'b' : 'w';
  // Flag to indicate when the AI is thinking or animating a move.
  let aiThinking = false;

  // Stack of moves that have been undone.  When the player undoes a move
  // (using the undo button) the move is pushed onto this stack.  Redoing
  // a move pops it from the stack and applies it again.  When a new
  // move is played, the redo stack is cleared.
  let redoStack = [];

  // Flag controlling whether to display threat arrows for the opponent's
  // potential captures and checking moves.  Toggled via the threat
  // button in the UI.
  let showThreats = false;

  // Track whether the board is currently flipped.  When true, the
  // visual orientation of the board is reversed.  The internal chess.js
  // state is unaffected.
  let flipped = false;

  let selectedSquare = null;
  let possibleMoves = [];

  /**
   * Reset the game to its initial state.  A new random side
   * assignment is chosen and the board is redrawn.  If the AI is
   * playing white it will immediately make the first move.
   */
  function resetGame() {
    game.reset();
    // Choose sides at random
    playerColor = Math.random() < 0.5 ? 'w' : 'b';
    aiColor = playerColor === 'w' ? 'b' : 'w';
    selectedSquare = null;
    possibleMoves = [];
    aiThinking = false;
    // Ensure board is unflipped on reset
    flipped = false;
    renderBoard();
    updateMoveList();
    // Refresh threat arrows (clears overlay because no moves have been played yet)
    updateThreatOverlay();
    if (aiColor === 'w') {
      triggerAiMove();
    }
    // Clear redo history on reset
    redoStack = [];
  }

  /**
   * Toggle the visual orientation of the board.  Flipping does not
   * affect the internal game state, only the display order of ranks
   * and files.  After toggling the board is re‑rendered.
   */
  function flipBoard() {
    flipped = !flipped;
    renderBoard();
  }

  /**
   * Undo the last move.  If the AI is currently moving, undo is
   * disabled.  After undoing, the board and move list are refreshed.
   */
  function undoLastMove() {
    if (aiThinking) return;
    const undone = game.undo();
    if (!undone) return;
    // Push the undone move onto the redo stack so it can be replayed
    redoStack.push(undone);
    selectedSquare = null;
    possibleMoves = [];
    aiThinking = false;
    renderBoard();
    updateMoveList();
    updateThreatOverlay();
  }

  /**
   * Redo the most recently undone move, if one exists.  If the AI is
   * currently thinking or there is nothing to redo, this function does
   * nothing.  Replaying a move clears any selected squares and refreshes
   * the board and move list.
   */
  function redoMove() {
    if (aiThinking || redoStack.length === 0) return;
    const move = redoStack.pop();
    // Apply the move exactly as it was undone.  Construct a minimal
    // move object containing only the fields accepted by chess.js: from,
    // to and promotion.  The move returned by undo() contains
    // additional metadata but can still be used to populate these
    // fields.  When promotion is undefined, omit the field.
    const redoObj = { from: move.from, to: move.to };
    if (move.promotion) {
      redoObj.promotion = move.promotion;
    }
    game.move(redoObj);
    selectedSquare = null;
    possibleMoves = [];
    renderBoard();
    updateMoveList();
    updateThreatOverlay();
  }

  /**
   * Toggle the display of opponent threats.  When enabled, arrows are
   * drawn on top of the board showing capturing moves (red) and moves
   * that would give check (orange) from the opponent's pieces.  The
   * overlay is cleared when disabled.
   */
  function toggleThreats() {
    showThreats = !showThreats;
    // Toggle the active state on the threat button to indicate whether
    // threat arrows are currently displayed.  When active, the button
    // adopts inverted colours defined in the CSS.
    const threatBtn = document.getElementById('threat-btn');
    if (threatBtn) {
      if (showThreats) {
        threatBtn.classList.add('active');
      } else {
        threatBtn.classList.remove('active');
      }
    }
    updateThreatOverlay();
  }

  /**
   * Create the SVG overlay for threat arrows if it does not already
   * exist.  The overlay uses absolute positioning to sit on top of
   * the board container and defines markers for red and orange
   * arrowheads.  This function should only be called once during
   * initialisation.
   */
  function initThreatOverlay() {
    let overlay = document.getElementById('threat-overlay');
    if (overlay) return;
    overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('id', 'threat-overlay');
    overlay.setAttribute('width', '100%');
    overlay.setAttribute('height', '100%');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.pointerEvents = 'none';
    // Ensure the overlay appears above the board squares and below any
    // animating piece by assigning a z-index between them.  The board
    // squares have default stacking (0) and .anim-piece uses z-index 10
    // in CSS, so choose an intermediate value here.
    overlay.style.zIndex = '5';
    // Define arrowhead markers
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    function createMarker(id, color) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '8');
      marker.setAttribute('refX', '6');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'strokeWidth');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M0,0 L6,3 L0,6 Z');
      path.setAttribute('fill', color);
      marker.appendChild(path);
      defs.appendChild(marker);
    }
    createMarker('arrow-red', '#f44336');
    createMarker('arrow-orange', '#ff9800');
    overlay.appendChild(defs);
    boardContainer.appendChild(overlay);
  }

  /**
   * Compute and draw threat arrows for the opponent.  Arrows are drawn
   * from the threatening piece to the target square.  Capture moves are
   * coloured red and potential checking moves are coloured orange.
   */
  function updateThreatOverlay() {
    const overlay = document.getElementById('threat-overlay');
    if (!overlay) return;
    // Clear existing arrows
    overlay.innerHTML = overlay.innerHTML.split('</defs>')[0] + '</defs>';
    if (!showThreats) return;
    // Determine which colour is the opponent
    const opponent = playerColor === 'w' ? 'b' : 'w';
    const boardState = game.board();
    // Build a lookup map of DOM squares
    const squares = Array.from(boardContainer.children);
    const boardRect = boardContainer.getBoundingClientRect();
    function squareCenter(name) {
      const el = squares.find(el => el.dataset.square === name);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left - boardRect.left + rect.width / 2,
        y: rect.top - boardRect.top + rect.height / 2
      };
    }
    // Collect threat lines
    const threats = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (piece && piece.color === opponent) {
          const fromSquare = 'abcdefgh'[c] + (8 - r);
          const moves = game.moves({ square: fromSquare, verbose: true });
          moves.forEach(move => {
            // Capture threat
            if (move.flags.includes('c')) {
              threats.push({ from: move.from, to: move.to, type: 'capture' });
            }
            // Check threat: simulate move and see if it results in a check on the player
            game.move(move);
            // After the move, it's the player's turn.  If the player is in check,
            // then the move gives check.
            if (game.in_check() && game.turn() === playerColor) {
              threats.push({ from: move.from, to: move.to, type: 'check' });
            }
            game.undo();
          });
        }
      }
    }
    // Draw arrows
    threats.forEach(th => {
      const start = squareCenter(th.from);
      const end = squareCenter(th.to);
      if (!start || !end) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', start.x);
      line.setAttribute('y1', start.y);
      line.setAttribute('x2', end.x);
      line.setAttribute('y2', end.y);
      line.setAttribute('stroke', th.type === 'capture' ? '#f44336' : '#ff9800');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('fill', 'none');
      const markerId = th.type === 'capture' ? 'arrow-red' : 'arrow-orange';
      line.setAttribute('marker-end', `url(#${markerId})`);
      overlay.appendChild(line);
    });
  }

  /**
   * Update the move list display on the right of the board.  Chess.js
   * provides a history of moves in standard algebraic notation.  The
   * list is cleared and repopulated each time to reflect the current
   * game history.  Moves are numbered with White and Black sharing
   * the same turn number.  For example: "1. e4 e5".
   */
  function updateMoveList() {
    if (!moveListEl) return;
    // Clear existing list
    moveListEl.innerHTML = '';
    const history = game.history();
    // History is a flat array of SAN strings.  Group into pairs.  Use the
    // surrounding <ol> element to automatically number the moves, so we
    // do not duplicate the turn number in the list item text.  Each
    // list item contains the white move and, if present, the black move.
    for (let i = 0; i < history.length; i += 2) {
      const whiteMove = history[i] || '';
      const blackMove = history[i + 1] || '';
      const li = document.createElement('li');
      li.textContent = `${whiteMove}${blackMove ? ' ' + blackMove : ''}`;
      moveListEl.appendChild(li);
    }
  }

  /**
   * Verify that the board rendered in the DOM matches the internal
   * chess.js board state.  If a mismatch is detected (e.g. a piece
   * appears on the wrong square), the board is re‑rendered from
   * scratch.  This helps guard against rare bugs where pieces
   * "teleport" due to stale DOM state.
   */
  function verifyBoard() {
    const boardState = game.board();
    const squares = Array.from(boardContainer.children);
    let mismatch = false;
    if (squares.length !== 64) {
      mismatch = true;
    } else {
      for (let row = 0; row < 8 && !mismatch; row++) {
        for (let col = 0; col < 8; col++) {
          const squareName = 'abcdefgh'[col] + (8 - row);
          const squareEl = squares.find(el => el.dataset.square === squareName);
          const piece = boardState[row][col];
          if (piece) {
            // Expect an <img> element inside the square
            if (!squareEl || !squareEl.querySelector('img')) {
              mismatch = true;
              break;
            }
          } else {
            // Expect no image when no piece
            if (squareEl && squareEl.querySelector('img')) {
              mismatch = true;
              break;
            }
          }
        }
      }
    }
    if (mismatch) {
      renderBoard();
    }
  }

  // Inline images for each chess piece.  Embedding the PNGs as data
  // URIs avoids the need to fetch separate files from the server and
  // ensures the game works entirely from a single HTML/JS bundle.  The
  // keys follow the pattern "<colour>_<type>" where colour is 'w' or 'b'
  // and type is one of p, r, n, b, q or k.
  const pieceImages = {
    'w_p': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAACe0lEQVR4nO2aP46CQBSHf8h2GBMLbLSxpJOYWNoZaq08ghcwHsLaxMbKU9B4Ao02xlhxAAotpJTdys2K/JlhmGFY+BIbwHnv882AYR5QUVFRUSAUgbG+Ca7hng/PACSCSWSeHw/hUFHP8xK/qGla1KnM8sxS+E2URDCJkB+AOd8shDMXDZKlOKvwrywP0SAB8VS51xjiC5UNiZPqppi2wt8hCQjlT7WpHNJUOHfZQHyqStMKSyH7Io00jbBUsi9opUmFs/jXJILEPKmmtGzVfUGTF4mwlFM5COnUZnkOF5Ik4UJU9wVJlblUeL1eQ9O02E+j0UC73cZgMMBsNoNt2/B9n0c6b8QJc63u8/nE/X7H+XzGdrvFZDLBcDjE9XplGjepylKt4ePxCMuy4DgOtxhSCQOA67qYz+fcxhcmbBgGPM+D53l4PB5wHAebzQa6rn9ca9s2XNflkkeUMNf1qygKWq0WptMpVqvVx3nf93E6nVKPH7eOc5/S/X4/9PjtduMSL3fhw+EQerzZbHKJ98VlVAJc18Vut8Nisfg4V6vV0Ov1uMQVJny5XOJew75hWVbozSwLcp/SQXRdx3K55Da+VMKmacK2bXS7XW4xclvDqqqiXq+j0+nANE2Mx2OMRiOoqso1rjBhwzCw3+9FhYskakorQOxej9TEvcKVag2LoBL+78QJF3IdJ23BlK7CJBtRhXmRR7LBVroKkwgXYi2Tbp9SVVhWaZq8SIVF9nOxkJgnTYWlnNq0nQC0Ny2ppNO0PaS5S0shnbbHg2VtCu/iAdhbl1iew7/BRFU7iz6tqhOPgdL0WgYpTTdtkNL0S0chRUd8RUVFsfkBQ87NaWlOxl0AAAAASUVORK5CYII=',
    'w_r': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAADD0lEQVR4nO2asWvyQBjGHz8/HEywQykU3IpYrEs3/4FOpVuhk7h0LoS6CELBoUOhgw5CpFPp1D+gq4tIhy6lS3cXIQ6p0hNENJ0sNdEkl8slJ+YZL+c978/3LjnuXiBSpEiRNkixAL0MF324x8PTwA2gk3yPjwfwSlBCiOMPJUla98i3OP0EXgJ1A+ikFX8Ac7x+APsOapaf4KzAv7A8QM0ygXuK/R+Df6CwK3w8vRS9ZthYEUCg+pNtKgYvGQ4d1uRPlWlaYCFgF/ICTQMsFOxCtNBugf3YNQUhxzipprRo2V2IJi43wEJOZbPcTm2W7/BGygl4I7K7kJss/+dhrKoqyuWybZ9kMomdnR1kMhkUCgVcXFwgn8/zCGdJdhnmmt3xeIx+v49Op4P7+3sUCgUoioLZbMY0rlOWhVnDhmHg4eEBNzc3XH2EAV6o2WxiNBpxGz8w4FwuB0IICCHQNA3dbhcnJyeWftPpFK+vr9ziWAfMdf1KkoTj42M8PT0hHo9bng8GA6bx7dZxqFM6lUphb2/P0r67u8vNM1Tg4XAITdMs7YeHh9w8QwEmhOD9/R2lUgnz+Xzp2enpKQ4ODrh5c9l4rNLn56fdMSwAIJvNol6vc41DiM9SKpXC9fU12u020uk0Vy8hgOfzOWazmeMM8ENCAH9/f6PRaKBYLMIw+J41BL7x0HUdb29vOD8/t/R5eXmBqqpc41gHHANs73o8K5FI4OjoCI+Pjzg7O7M8v729xdfXF5OH3RFuaFM6Fouh0WhAluWldl3XcXd3x8031DW8v7+Pq6srS3ur1UKv1+PiGfpLS1EUy/ZyMpmgVqtx8bMD5raO/0qWZVQqFUv78/MzPj4+qMdzuoIJPcMAcHl5adlOGoaBarXqu5ebi6iNOchzc8EmRIaDlBvgQNYyq9xen1JlWFRomrjcAgdZz8UixzhpMizk1KatBKB9aQkF7aXswctbWghorzUeLGsz8CoegL10ieU7/GsWVLb9qNOKKvEYtDW1lmZtTTWtWVtTL71OQlTER4oUabP1A3EQBlxV9T0SAAAAAElFTkSuQmCC',
    'w_n': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAACjElEQVR4nO2ava4BQRSADwqRLUQtGp2EWuEJaLQSDyB6UW2ElYhOoVEoPIDCAyj0Cg8g2UQpUdqKZG9lcu3vzM7s2dmYL1HMvew5n7MzKzMHQKFQKFJEBjGWTfGe2POJMwCNYBjC84tD2FPUsqzQD2qa5vcvYXmKFP4SpREMw+ML4M5XhLBwUScixXmFiWwcok4c4pFyz3LER5X1iBNpUYxaYdsjAVT+VZvJIUqFE5d1xGeqNKuwFLIfokizCEsl+4FVmlZYxK8mDELzZLqlZavuB5a8aISlvJWd0N7aPM/hVBImnIrqfqCpsvAKbzYb0DTN9ep2u76fud1urvc3Gg3RqQFAsLDQ6h6PRzidTkKuFURYlVHnsK7rYNvJPuFQhS+XC+z3e8yQLtBXacMw4PV6YYcl+AnHtjqbpgnb7Vb4df8TNI9RKlytVr/Gy+USns8nRmgXKMLtdhuazSYZPx4PWK1WGKFdoM3h+Xz+NV6v13C/37HCE9CEW60WdDodMrYsCxaLBVZ4AuoqbRgG5HI5Mt7tdnC9XjFTwBWu1WrQ7/fJ+P1+w3Q6xUwB/zms6zoUCgUyPhwOcD6f0eKjC5fLZRgOh19/m81maPH9hDMAgWc9XIxGIyiVSmRsmqbQ6wdt4SayAVAsFmE8HicROrkdj8FgAJVKBT1uYsL5fB4mkwl63CDhWOcxAECv14N6vS70mmFHMIlu4mWzWddPzrihOYhKzUYezQGb2qb1IPa5LALa41OmCssqzZIXrTBmPxcPoXmyVFjKW5u1E4B10ZJKOkrbQ5RVWgrpqD0ePHMTvYsHgL91iec5TIJhVVtEn5bqxOPgZ3otnfxMN62Tn+mX9kOKjniFQpFu/gCVjckdqlwIeAAAAABJRU5ErkJggg==',
    'w_b': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAC8ElEQVR4nO2avYvyQBCHfxFRUbFQsLQQEYRrxOJAsFSus7KzFKzFK0Sxvc7Owsrm/DPEQrBUEARLmwMRQRCyFiLkrTxe40c2HxNXLk95ye3M4+xuQnYABwcHhxdCsjGWwnEPeT6UAXgEtbA8Pwrhm6KMMc1/DAQC9y5ZlqeVwheiPIJa3PgBTOdrhbDlomqsFDcr/CtLIapGJW4od5eJ+LbK3ohjaFM0WmHlRgK28l+1dTkYqfDTZVXxdVVar7AQsmeMSOsRFkr2jF5pXmEr3prsQDNPXVNatOqe0ZMXj7CQU1kN79Q28xx+SbSEX6K6Z3iq7KYI3Ov1UK/X716XJAl+vx+hUAjxeBzpdBrFYhHZbJYinQseVZisuoqigDGG9XqNyWSCbreLfD6PYrGI/X5vamytKgu1hofDIcrlMmkMoYQBYDQaYTqdko1vm3AqlQJjDIwxyLKM1WqFZrN5897JZEKWxz1h0t1ZkiREo1G0Wi28vb1dXd/tdqbGf7SOhZvSABCNRsnGJnks8bDdbtHv97FYLC7+LkkSCoUCWVzbhJfL5aOvkr/UajUkEgmyPJ5WYTVutxudTgeVSoU0jjBr+HQ64evrC4PBgDSOMMIAsNlsUK1W8f39TRbjKc9hxhg2mw3G4zE+Pj6u7m232zgcDiR5PK3CwWAQmUwGg8EAXq/34tp2u8V8PieJe09YAh6e9ViKoly/5//8/Bge79En3KdVWJZlzGYzlMtlHI/Hq+vhcJgkrnDPYQDw+Xx4f38nyUOoXfrM5+cngsEgydiPhG1dxwDg8XjQaDTQaDQMj6F1BPO0Ny2XywW/349IJIJkMolcLodSqYRYLEYal+cg6mU+5PEcsAm5hinhEbZ9LRuB9/hUV4VFldaTF6+wnf1cZtDMU0+FhZzaejsB9G5aQkkbaXswsksLIW20x8PM2rS9iwcw37pk5jn8G8yualvRp+V04pngz/Raqvkz3bRq/ky/9D2E6Ih3cHB4bf4Bv5f4bIQmlw0AAAAASUVORK5CYII=',
    'w_q': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAEOUlEQVR4nO2aO0grQRSG/41XFBXEgIhEAhEtlFQWgqIosfBRihAQ1ELtjGBlkUKJVRqJIggWRrSTNIKFD3xAEJYUWigiPgoLH4RImgQsZPcWl5Uk+56ZjbmYD9Kc3TPn/DmzO7O7ByhSpEiR/wguj7FEA+dYno+VAYwI1IN5flYIVhSaTqd1HSsrK9UOMcuTpeAsoUYE6qHwB1Dny0Iwc6G5sBROK/hbrBVCc8kRTpS7jSJ+XsUqxCG6KZJWWFRIIK9kVNuUBpIK/7jYnPimKm1WcEGIlSARbUZwQYmVMCvaqGAWu6Z8oJunqSldaNWVMJOXEcEFOZVzMTq1/1idiCAIODw8xMnJCXiex9vbG5LJJEpKSlBTUwOn04mOjg709/ejq6vL6nR01zCq6u7t7WFhYQEPDw+Gzm9ra0MwGERnZydRPEB/fabZaakiiiLm5+cxOjpqWCwAXF5eYnBwEGtra1akBUC7wsTVDQQCCAaDpDkBADY3N+H1eol8tarMvMI8zyuKLS0thc/nA8/zSCQSeH9/x/HxMUZGRhTHmZmZQTweZ52eJiIAMZ1Om/r19vaKkq/0s9lsYiQSUfVZXFyU+QAQZ2dnTcdPp9OZY8hgOqXj8ThcLpfMPjU1hZWVFfVAogiPx4NYLJZldzgcuL+/NxxfgmRKE12/5+fnivbJyUlNP47jFM95eXnB4+OjqRwA7TWZ6TX89PQks1VUVMDtduv6tre3K9qfn5+p88qEqeCPjw+Zrba2Fjabfpi6ujrDY9JgyTqcCccZez4XReUdoZqdFKaC7Xa7zJZIJAwlrbYEKY1JA1PBjY2NMlsqlcLd3Z2ub+4dWqKlpYU6r0yYCu7p6VG0b29v6/qGw2GZrbm5GQ0NDdR5ZcJUcH19Pbq7u2X29fV1RKNRVb/l5WXwPC+zj4+Ps0wPgPrGg3gfHY1GMTAwILOXl5fD5/PB6/XC5XLh6+sL19fX2NjYwO7urux8h8OBq6srrc8vmqhtPix5ePD7/QiFQqb9JMrKyrC/v0/8mJjXhwcAWFpawvT0NJFvdXU1IpEI1TOxFpYIttlsCIVC2NnZQVNTkyEfjuMwPDyMWCwGj8djRVr/4mgcY/IuSxAEHB0d4fT0FDzP4/X1FclkEp+fn1nn2e12XFxcwOl0UsUDtKe0pa94tLi5uUFfXx9SqdS3rbW1FWdnZ6iqqiIe90de8RjB7XYjHA5n7bNvb28xMTEBQRAsi6snmAM0v8xTMTQ0hEAgkGU7ODiA3+8nGs/IB7Yfq7DE3NwcxsbGsmyrq6vY2tqyJJ7RT40F/zLe6OdTUxW2amrTYiYvo4Lz2c9Fg26eZips6Q2MFLOdAGZvWgUlmqTtgeQuXRCiSXs8aK7NvHfxAPStSzTr8HewfFWbRZ9WsROPgl/Ta5nLr+mmzeXX9EurURAd8UWKFPm/+QumSPbzBMTs3wAAAABJRU5ErkJggg==',
    'w_k': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAADT0lEQVR4nO2asUs6YRjHvxrphQQNDi4i0hANTbU4ucSpmIQFEkJNjv0zTTXU4NBgUNgQyIEgDrbUINLgIBk0CEkYoQZR/Sbjd3fq3Xv3vu+ddF9wed67+z4fn3vfO957AEeOHDmaIbk4ev3oOIZ5PiwN9ABqiXp+LIDHgvb7fc0TfT7fpCFqedIEloHqAdTSmD/AdL40gKmDKkUT3CzwLywLUKUU4IZyd5vw5wo7xsfQomi0wj9jEuCq/6pNxGCkwpbDKvyJKk0KbAvYkYxAkwDbCnYkUmi9wDTemnhIM0+iW9pu1R2JJC89wLa8lZXSe2ubeQ7PpLSAZ6K6I+mpMvUKn5ycwOfzyX4bGxsTj280GgiFQqpzVldX8fj4SDu9qcDMq3t/f494PI5utyuLLy8vQ5IkhMNh4mtqVdmyOVyr1ZBMJtHr9WTxlZUVSJKEYDDIxNcS4Eqlgu3tbby/v8via2trkCQJgUCAmTd34FKphN3dXQwGA1l8fX0dpVIJfr+fqf8kYCbzt1gsYm9vDx8fH7J4JBLBzc0NlpaWqPhMm8fcKlwoFHBwcIDPz09ZPBqN4vr6GouLi1zy4ALcbreRy+Xw9fUli4uiiKurq2mbd9TFBXg4HOL7+1sWS6VSKBQKEASBRwq/smSV9vv9OD09hcfj4e5tCXC320U2m8VwOOTubdmLR7lcxs7ODvf3dC7A4XAY0WhUFa9Wq2NfQFiKC7AgCLi8vMTm5qZq7Pb2FltbW3h7e+ORykRgFzD1Ww+xFhYWcHFxgWQyqRq7u7tDIpHA6+srFa9pW7hc57DX68X5+TnS6bRqrF6vIx6P4+XlhWkO3Bet+fl55PN5ZDIZ1djDwwNisRg6nQ4zf0tW6bm5OZydnWF/f1811mw2IYoinp+fmXhPA6Y+j2XGbjeOj4+Ry+VUY61WC6Ioot1uE19X6xOMpZt4LpcLR0dHODw8VI09PT0hFouh1WrR9dRxzMxs5On5wOZs044R07lMS3o/nxJV2K7QJHnpBebZz2VGmnmSVNiWtzZpJwDpomUraCNtD0ZWaVtAG+3xMDM3uXfxAOZbl8w8h3/NeFWbRp+W04lnQn+m11KpP9NNq9Sf6ZeeJFt0xDty5Gi29Q/apBsiFSEjRQAAAABJRU5ErkJggg==',
    'b_p': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAACd0lEQVR4nO2aodKqQBTH/zA3M+NWk45BrQad8R2MvIJVZxyfwGgxGn0JG1EtWsFkM2ggOFqXm3Tux4ewy7LLcuEXBTnn59kDjHuAioqKigJhKIwVMJwjPR+ZAVgEk8g8PxnCkaK9Xi/xi6fT6duhzPLMUviHKItgEhE/gHC+WQhnLhomS3FR4Y+sDNEwIfFUuZsC8ZXKRsRJdVNMW+EgIgGl/FNtLoc0Fc5dNhSfq9K8wlrIvkkjzSOslewbXmlW4SzemlSQmCfXktatum948mIR1nIph2Fd2iLP4UKSJFyI6r5hqfIfGYFt28Z8Po89h1KK5/OJ+/0O13XhOA4OhwMopTJS+hBXYanVNU0TlmWh1WphNBphtVphs9mg0WgIXTepylr1cKfTwXq9Rr1elxZDK2EAIIRgNptJu76UHo7icrnAtm0AgGEYqNVqGAwGmEwmIIT8OHc4HIIQAt/3M8/jW4Wl9m8QBPB9H9vtFovF4ndSpol2u536+nF9nPuSdl038nPLsqTEy1242+1Gfv54PKTEU9bDYQgh6Pf7mE6nv45RSnE+n6XEVSbcbDZxPB6Zzt3tdlJuWIAGSzqM7/tYLpfSrq+VsOd5GI/HuF6v0mLk1sOUUrxeL9xuN3ieB8dxsN/vpb9L5/LikSfflrQBxO71aE3cX7ha9bAKKuH/nTjhQvZx0hZM6SrMshFVmD/yWDbYSldhFuFC9DLr9ilXhXWV5smLVVjlPJcIiXnyVFjLpc07CcB709JKOs3YQ5q7tBbSaWc8RHpT+RQPID66JPIc/gRTVe0s5rSqSTwBSjNrGaY007RhSjMv/Q0tJuIrKiqKzV/y8tiDK4wWqAAAAABJRU5ErkJggg==',
    'b_r': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAADCklEQVR4nO2aP0vDQBjGn4RSVGwGwcFJcHAVbBaHdncvKYgOuohUcBPbL2D9Dl1KKZ3avXTSpYsObg7+Ax1FxIZEEKxTRZM2ucvlTa6YZ0zOPO/P5y4Xei+QKFGiRFMkJUKvIcMY8nooDVgA/RR6fRTAY0Gz2azvH15dXU26FVqdYQL/AWUB9NOYf4BwvWEAhw7qVJjgosA/sBSgTjnAA9WuCvhHCjvGJ9BLMWjCwzEFRKpfaXMxBEk4dliHP1fSvMBSwI4UBJoHWCrYkXihWYHD+GqKQr51ck1p2dIdiacuFmApp7JTrFNbZB+eSvkBT0W6I7GknKIwNgwDx8fHnmM+Pj4wGAzw9PSE6+trdLtd3N7eUpTzR14Jk6Y7MzODxcVFrK+vY3d3F61WCycnJ1BVsVXml7I0a1hRFBQKBRweHpL6SAM80tbWFubn58meHxnw/f09dF2HruvI5XLY3t5Gv993jUulUlhbWyOrYxIw6fq1bRs3Nzcol8v4+vpy3V9YWBB6vtc6jnVKm6aJ19dX1/W3tzcyz1iBM5nM2DQfHh7IPEn2YT/Nzs5ieXkZpVLJtQ1dXFzg+fmZzDsy4JWVFVxeXnqOeXx8RLVaJa0jloSdMk0T7XYb9Xod7+/vpF5S7MOqqkJVVdi2Te9F7sCgubk57Ozs4OzsDIpCe7wU+YfHxsYGisUier2ea0w+n4dhGKR1TAJWAM+znsD6/PzE3d0dKpUKzs/PXff39/ehaZqQh9dPuLFN6eFwiNPTU1iW9ee6pmnY29sj8411Db+8vKDZbLquG4aBpaUlEs/YX1qNRsP1eZlOp3FwcEDi5wVMto5/y7Is1Go11/XNzU2srq5yP8/vCCb2hAGg0+m4PicVRcHR0VHoXiyb3tT8kMdywCZFwlGKBTiStSwq1uNTroRlheapixU4yn4uEfnWyZOwlFObtxOA96UlFXSQtocgb2kpoIP2eIiszci7eADx1iWRffjHLKq0w+jTSjrxBPRvei2d+jfdtE79m37pSZKiIz5RokTTrW8v9PnHY7JaIgAAAABJRU5ErkJggg==',
    'b_n': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAClElEQVR4nO2ar+vCQBTAn18t2sQmwy7YBMEq2AeCRTCJYbjqP6KgSYxiFMGuwSSCVTAtiFGThn2/yeO7H2532+3thvdpN3XvfXy727g9AIlEIkkQKcRYvxTfiTyfKAPQCPrBPb8ohF1Fq9Wq7w8Ph8Onj7jlyVPYIkoj6IfLHxA6Xx7C3EXt8BQPK0xkoxC1YxMPlPtPiPiosi5xAi2KQSv865IAKv+qzeQQpMKxy9riM1WaVVgI2TdBpFmEhZJ9wypNK8zjqQkD3zyZLmnRqvuGJS8aYSEvZTu0l3aY+3Ai8RNORHXf0FQ5wztou92G4XDoOL7f70HXddffFItFWK1WlmOGYYCqqrzT86ww1+rW63Wo1WpczuWFX5VR57Cu65BKYW6yOEEVLpfL0Gw2MUM6QF+lNU2DTIb70kHNJ+HIVmdFUaDVanE/73+85jFKhQ3DsIx7vR7kcjmM0A5QhHe7HZxOJzLO5/PQ7XYxQjtAm8Oj0cgy7nQ6UCgUsMIT0ISPxyNst1syzmaz0O/3scITUFfp8XgMpmmSsaqqUCqVMFPAFb5cLrBer8k4nU7DYDDATAH/PjydTuH5fJJxo9GASqWCFh9d+Ha7wWKxsBzTNA0t/ifhFIDnu55QzOdzuN/vZKwoCtfze23hxrIB8Hg8YDabxRE6vh2P5XIJ1+sVPW5swq/XCyaTCXpcL+FI5zEAwGazgfP5zPWcfq9gYt3EM03T8cgZNTTbD4nZyKN5wSa3aV2IfC7zgPb1KVOFRZVmyYtWON6tRnp882SpsJCXNmsnAOuiJZR0kLaHIKu0ENJBezzCzE30Lh6A8K1LYe7DJBhWtXn0aclOvBB8Ta+lna/pprXzNf3SnxCiI14ikSSbP+9OyYtnr5hMAAAAAElFTSuQmCC',
    'b_b': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAC+0lEQVR4nO2aP2vyUBSHf3n7OrRQhJTiKkIRugUjUnDuVsHFwQ+QydmOXUvXbiFQcPcD6NCxky3ioENBRAQ3EZEQIjadLDVVc/PnxCvm2eqN95yn594bSQ4QERERcUAIIcayGK4hz4cyAIugE4HnRyG8UTSTyTh+8f39fdtQYHkGKbwmyiLoxIZ/gO98gxAOXNROkOJ+hX9kKUTt2MQ95f7PR/xQZTfE8XQoeq2wtSGBUPlVbVcOXiq8d1lbfFeVdivMhewKL9JuhLmSXeFWmlU4iF9NYeCYp6slzVt1V7jJi0WYy6Vsh3Vp+7kPHyROwgdR3RUsVf5PEbhUKqFarW4dtywLhmFgPp9jNBqh1+vh9fUV7XabIp01dlWYrLqCIOD09BSXl5eQJAnlchmapuH5+Rnn5+e+5naqMld7+ObmBo+Pj6QxuBIGgFwuh+vra7L5QxPu9/uQZRmyLCObzeL29haqqm68VpIksjy2CZOezpZlYTKZQFVVfH5+/hmPx+O+5t+1j7lb0gAwmUzI5ia5LbEgiiKKxSKurq7WPrcsC29vb2RxQxNOpVJotVqO19VqNQyHQ7I89lZhO8vlEk9PT6jX66RxuNnDJycnUBQFd3d3pHG4EQaAi4sLPDw8oFAokMUIbUn3+32USqWfv8/OzpBMJqEoCvL5/Nq1lUoFzWYThmEEnsfeKqzrOrrdLu7v72Ga5tqYKIpIp9MkcbcJC8DOdz2BIgh/n7QmEgnP8+16hLu3U/r3ko7FYn/GZ7MZSVzu7sMAYJomOp0OSR5cndIrXl5eoOs6ydy7hEPdxwCwWCygaRo0TfM8h9MrmL3t4a+vLxiGgel0isFggI+PDzQaDYzHY9K4LC+iDuZBHssLNi73MCUswqHvZS+wvj51VWFepd3kxSocZj+XHxzzdFNhLpe2204At4cWV9Je2h68nNJcSHvt8fCzN0Pv4gH8ty75uQ//BAur2kH0aUWdeD44ml5LO0fTTWvnaPqlt8FFR3xERMRh8w3VUv3Iu4FWUAAAAABJRU5ErkJggg==',
    'b_q': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAEKUlEQVR4nO2aTyg8YRjHv7u2TXNg21oHRaG9KLNFIZwU5YQLQja5bJM/2VKKK8mByxw4SDlu/kSOTuSwiaaUi92DTW3I1lJCmv2daHdndv687ztrf9nP8THPvN+v533fmXf2AYoUKVLkP8KWx7FSBq6xXI+VAxgxqAdzfVYYVjXa1NSkm3h5eZnrT8x0sjScYdSIQT1U/gHUelkYZm40G5bGaQ3/mLXCaDZZxom02ynGz6tZlXGINkXSCqdUBOSVtGqb8kBS4V83mzW+qUqbNVwQZr8hMW3GcEGZ/casaaOGWbw15QNdnaamdKFV9xszuowYLsipnI3Rqe2wWojdbkd7eztaW1vB8zw8Hg/KysogyzJeXl4Qj8chSRLOz89xdXVltRzdZxhVdTs7OzE5OYnq6mpD19/c3GBtbQ2SJBGNB+g/n2netHJis9kQDAaxurpq2CwA1NfXY3NzE8PDw1bIAqBtmLi6gUCAWHRJSQmCwSB6enqI8vXWMvM1zPM8JiYmFPGvry+EQiEcHx/j7u4ODocDXq8XAwMD6O7uVly/sLCAcDiMRCLBVB9zw4FAQBGTZRlzc3M4Ozv7iX18fECSJEiShEgkAkEQMnJKS0vh9/uxvr7OVB/TNex2u9Hc3KyIHxwcZJjNZnt7G9fX14p4V1cXS3kAchsmWr9qZgFgb29PMy+VSmF/f18Rr6ioMLXpfaO1jplWuKqqShF7f39HJBLRzVWrMABUVlZS60qHqWGXy6WIJRIJyLKsm/v8/Gz4njRY8hwmwWZTfwfKFSeFqeFkMqmIuVwuQ6Ldbrfhe9LA1PD9/b0ixnEcampqdHMbGhpU49FolFpXOkwNX1xcqMZ7e3t1c/v7+xWxWCyGh4cHal3pMDX89PSkeuIZHBxEY2Njzjy/3w+e5xXxw8NDlvIAWLBpbWxsKGIOhwOiKEIQBNTW1sLpdILjOPh8PiwtLWFqakqR8/j4iFAoxFqe5vGQ+PAwPT2NsbExUk34/PyEIAjEx0StI6IljyVRFLG7u0uU+/r6itnZWaozsRaWGJZlGSsrK5ifn0csFjOUk0qlcHJygqGhIYTDYStkAbBoSqdjt9vR1taGlpYW+Hw+eDwelJeXw+l0ZlyXTCYxOjqKeDxONR6gPaUt/cSjhdfrxdbWFjiO+4lFo1GMj4/j7e2N+L6/8onHCLe3t1hcXMx4z66rq8Py8jLsdutk6d3ZBmj+Mk/F6ekpRFHMiHV0dGBmZobofkZ+YPv1w8POzg6Ojo4yYiMjI+jr67NkPKNHkYL/GG/051NTFbZqatNiRpdRw/ns56JBV6eZClu6gZFithPA7KZVUKZJ2h5IdumCME3a40GzNvPexQPQty7RPId/BstXtVn0aRU78Sj4M72W2fyZbtps/ky/dC4KoiO+SJEi/zf/AMU6YU0ZR+FjAAAAAElFTkSuQmCC',
    'b_k': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAADVElEQVR4nO2aP0tCURjGn0KykBIjEAyHIBRqMCiiwcnNL+A3MBSEAkFoEaLBiAYFNeXubS1OLkE05CANLQ0NNYToEAhBhBbaZHT/6L3n3nPOvdJ9xvOqz/vzPefcyzkvYMuWLVtTpBmOXkMNn2GeD0sDLYBqop4fC2BF0O3tbdUv3t/fjwtRy5MmsAhUC6CaFP4Aw/nSAKYOKhVNcKPAv7AsQKWSgOvKfdaAP1dYBR9dm6LeCg8VEuCqP9UmYtBTYdNhJf5ElSYFtgTsSHqgSYAtBTsSKbRWYBpvTTykmifRlLZadUciyUsLsCWnslRap7aR5/BUSg14Kqo7kpYqO2ibxmIxZDIZ0djz8zNisZji5wOBAEqlEjwej2i83W4jkUig1WpRzW9ShZlXd2NjA5VKRQb7+vqKeDyuC1atyqat4a2tLVxcXGBpaUk0/vLygng8jk6nw8TXFODd3V0Ui0W4XC7R+NPTE/b39/H29sbMmztwOBxGPp/H/Py8aPzx8RGJRALdbpep/zhgJus3Eong/Pwcc3NzovGHhwckk0m8v79T8Zm0jrlVOBqN4vT0FA6H+MHQbDaRSqXw8fHBJQ8uwKurqzg+PsbsrNju7u4OBwcH+Pz85JEGAE7ATqdTBntzc4N0Oo1+v88jhV+Zskt3u11ks1l8fX1x9zYF2OPx4OzsDE6nk7u3aS8ee3t7KBQKWFhY4OrLBbjVaqHZbMrGd3Z2FF9AWIoLcK/Xw+HhIRqNhiwWCoVQLpexuLjII5WxwDPAxLseYvV6PaTTadze3spim5ubqFQqcLvdVLwmHeFyXcP9fh+ZTAbX19eyWDAYRLVaxfLyMtMcuG9a39/fODo6Qr1el8XW19dRrVaxsrLCzN+UXXowGCCbzaJWq8lia2trEAQBXq+XifckYOrr+K8GgwFOTk5wdXUli/n9fgiCAJ/PR/y7alcwph7iDYdD5HI5XF5eymI+nw+CIMDv91P11HIRNTUHeVou2OxjWgUxXcu0pPX6lKjCVoUmyUsrMM9+LiNSzZOkwpac2qSdAKSblqWg9bQ96NmlLQGtt8fDyNrk3sUDGG9dMvIc/jXjVW0afVp2J54B/ZteS6n+TTetVP+mX3qcLNERb8uWrenWD6AXFb1jP2X7AAAAAElFTkSuQmCC'
  };

  // Lookup the appropriate image for a piece.  The colour and type
  // together form a key into the pieceImages map.
  function getImagePath(piece) {
    return pieceImages[`${piece.color}_${piece.type}`];
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

    // When the board is flipped, display the ranks and files in reverse
    // order.  Compute display indices separately from the indices used
    // to access the internal board state.  The square names are always
    // based on the logical row/col, not the display orientation.
    for (let rDisplay = 0; rDisplay < 8; rDisplay++) {
      for (let cDisplay = 0; cDisplay < 8; cDisplay++) {
        const row = flipped ? 7 - rDisplay : rDisplay;
        const col = flipped ? 7 - cDisplay : cDisplay;
        const squareEl = document.createElement('div');
        squareEl.classList.add('square');
        squareEl.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
        const file = 'abcdefgh'[col];
        const rank = 8 - row;
        const squareName = file + rank;
        squareEl.dataset.square = squareName;
        const piece = board[row][col];
        if (piece) {
          const img = document.createElement('img');
          img.src = getImagePath(piece);
          img.classList.add('piece-img');
          squareEl.appendChild(img);
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
    // Update the move list to reflect current history
    updateMoveList();
    // Verify DOM board matches internal state; re‑render if mismatch
    verifyBoard();
    // Refresh the threat overlay whenever the board changes.  This
    // ensures arrows are redrawn in the correct positions and
    // cleared if the feature is disabled.
    updateThreatOverlay();
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
      // Determine if this move results in pawn promotion.  When a pawn
      // reaches the opposite end of the board, chess.js requires a
      // promotion piece code ('q', 'r', 'b' or 'n').  Prompt the user
      // to choose their desired piece.  If they cancel or provide an
      // invalid choice, default to queen.
      const movingPiece = game.get(selectedSquare);
      let promotion = undefined;
      if (movingPiece && movingPiece.type === 'p') {
        const targetRank = square[1];
        // Check promotion rank: 8 for white pawns, 1 for black pawns
        if ((movingPiece.color === 'w' && targetRank === '8') ||
            (movingPiece.color === 'b' && targetRank === '1')) {
          const choice = prompt('Promote to (q = queen, r = rook, b = bishop, n = knight):', 'q');
          const valid = ['q','r','b','n'];
          if (choice && valid.includes(choice.toLowerCase())) {
            promotion = choice.toLowerCase();
          } else {
            promotion = 'q';
          }
        }
      }
      game.move({ from: selectedSquare, to: square, promotion });
      selectedSquare = null;
      possibleMoves = [];
      // Clear any redo history because a new move invalidates the
      // ability to replay previously undone moves.
      redoStack = [];
      renderBoard();
      // After the human moves, update move list and trigger AI response.
      updateMoveList();
      // Refresh threat arrows to show the new opponent threats.
      updateThreatOverlay();
      triggerAiMove();
      return;
    }
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      const moves = game.moves({ square: square, verbose: true });
      possibleMoves = moves.map(move => move.to);
      renderBoard();
      // Highlight available moves but do not alter the redo stack
      // here.  Threat overlay refresh happens inside renderBoard().
    } else {
      selectedSquare = null;
      possibleMoves = [];
      renderBoard();
      // Also refresh threat overlay when deselecting a square
      updateThreatOverlay();
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
    // Create an element to animate.  Use an image rather than a text
    // character so the animation matches the icons on the board.
    const movingPiece = document.createElement('img');
    movingPiece.src = getImagePath(piece);
    movingPiece.classList.add('anim-piece');
    // Determine the size of a square for centering the image.  Assume the
    // piece images are smaller than the square (see CSS for .piece-img).
    const squareSize = fromEl.clientWidth;
    // Since the .anim-piece class defines a fixed width and height in CSS,
    // there is no need to query computed styles before the element is
    // attached to the DOM (which may return 0).  Use the known size
    // directly so the animation centres correctly.
    // Determine the image size consistent with CSS (piece-img uses
    // 67% of the square size).  This allows the animation to adapt
    // when the board is responsive.
    const imgSize = squareSize * 0.67;
    // Position the moving piece at the centre of the from square relative to the board
    movingPiece.style.left = (fromRect.left - boardRect.left + squareSize / 2 - imgSize / 2) + 'px';
    movingPiece.style.top = (fromRect.top - boardRect.top + squareSize / 2 - imgSize / 2) + 'px';
    boardContainer.appendChild(movingPiece);
    // Hide the piece on the from square during animation by clearing its
    // content (removing any child elements) rather than just clearing text.
    fromEl.innerHTML = '';
    // Trigger the CSS transition to move the piece to its destination
    requestAnimationFrame(() => {
      // Move the piece to the destination square.  Use imgSize instead of the
      // undefined variable pieceSize to centre the image correctly.
      movingPiece.style.left = (toRect.left - boardRect.left + squareSize / 2 - imgSize / 2) + 'px';
      movingPiece.style.top  = (toRect.top  - boardRect.top  + squareSize / 2 - imgSize / 2) + 'px';
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
      // Do not show highlights for the AI's move; clear any human highlights.
      selectedSquare = null;
      possibleMoves = [];
      animateAIMove(move, () => {
        game.move({ from: move.from, to: move.to, promotion: move.promotion });
        selectedSquare = null;
        possibleMoves = [];
        aiThinking = false;
        // Clear the redo history since a new move has been played
        redoStack = [];
        renderBoard();
        // Update move list after AI moves
        updateMoveList();
        // Refresh threats after the AI move
        updateThreatOverlay();
      });
    }, 400);
  }

  // Initialise the threat overlay before the initial render.  This
  // ensures the SVG overlay exists when the board is first drawn.
  initThreatOverlay();
  // Initial draw of the board
  renderBoard();
  // If the AI is playing white, let it move first
  if (aiColor === 'w') {
    triggerAiMove();
  }

  // Attach event handlers for the reset, flip and undo buttons.  Use
  // optional chaining in case the elements are not present in the DOM.
  const resetButton = document.getElementById('reset-btn');
  if (resetButton) resetButton.addEventListener('click', resetGame);
  const flipButton = document.getElementById('flip-btn');
  if (flipButton) flipButton.addEventListener('click', flipBoard);
  const undoButton = document.getElementById('undo-btn');
  if (undoButton) undoButton.addEventListener('click', undoLastMove);

  // Attach handlers for the new redo and threat toggle buttons.  When
  // replaying moves, invoke redoMove().  When toggling threat
  // highlights, invoke toggleThreats().  Use optional chaining to
  // gracefully handle missing elements.
  const redoButton = document.getElementById('redo-btn');
  if (redoButton) redoButton.addEventListener('click', redoMove);
  const threatButton = document.getElementById('threat-btn');
  if (threatButton) threatButton.addEventListener('click', toggleThreats);
});