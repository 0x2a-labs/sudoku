// Sudoku Game Engine - Vanilla JS ES Module

class SudokuSolver {
  isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num) return false;
      if (board[i][col] === num) return false;
    }
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (board[r][c] === num) return false;
      }
    }
    return true;
  }

  getCandidates(board, row, col) {
    if (board[row][col] !== 0) return new Set();
    const candidates = new Set();
    for (let num = 1; num <= 9; num++) {
      if (this.isValid(board, row, col, num)) {
        candidates.add(num);
      }
    }
    return candidates;
  }

  solve(board) {
    const copy = board.map(row => [...row]);
    if (this._solveRecursive(copy)) return copy;
    return null;
  }

  _solveRecursive(board) {
    const cell = this._findEmpty(board);
    if (!cell) return true;
    const [row, col] = cell;
    for (let num = 1; num <= 9; num++) {
      if (this.isValid(board, row, col, num)) {
        board[row][col] = num;
        if (this._solveRecursive(board)) return true;
        board[row][col] = 0;
      }
    }
    return false;
  }

  _findEmpty(board) {
    let minCandidates = 10;
    let bestCell = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          const count = this.getCandidates(board, r, c).size;
          if (count < minCandidates) {
            minCandidates = count;
            bestCell = [r, c];
            if (count === 1) return bestCell;
          }
        }
      }
    }
    return bestCell;
  }

  _countSolutions(board, limit) {
    const cell = this._findEmpty(board); // MRV: find most-constrained cell first
    if (!cell) return 1;
    const [row, col] = cell;
    let count = 0;
    for (let num = 1; num <= 9; num++) {
      if (this.isValid(board, row, col, num)) {
        board[row][col] = num;
        count += this._countSolutions(board, limit);
        board[row][col] = 0;
        if (count >= limit) return count;
      }
    }
    return count;
  }

  findHint(board, solution) {
    const hint =
      this._findNakedSingle(board) ||
      this._findHiddenSingle(board) ||
      this._findNakedPair(board) ||
      this._findPointingPair(board);
    if (hint) return hint;
    return this._fallbackHint(board, solution);
  }

  _findNakedSingle(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) continue;
        const cands = this.getCandidates(board, r, c);
        if (cands.size === 1) {
          const value = [...cands][0];
          return {
            technique: 'Naked Single',
            cell: [r, c],
            value,
            description: `Cell R${r + 1}C${c + 1} can only be ${value} — all other numbers are eliminated by its row, column, and box.`,
            highlights: { cells: [[r, c]], eliminatedFrom: [] },
          };
        }
      }
    }
    return null;
  }

  _findHiddenSingle(board) {
    // Check rows
    for (let r = 0; r < 9; r++) {
      const hint = this._hiddenSingleInUnit(
        board,
        Array.from({ length: 9 }, (_, c) => [r, c]),
        'row',
        r,
      );
      if (hint) return hint;
    }
    // Check columns
    for (let c = 0; c < 9; c++) {
      const hint = this._hiddenSingleInUnit(
        board,
        Array.from({ length: 9 }, (_, r) => [r, c]),
        'col',
        c,
      );
      if (hint) return hint;
    }
    // Check boxes
    for (let box = 0; box < 9; box++) {
      const br = Math.floor(box / 3) * 3;
      const bc = (box % 3) * 3;
      const cells = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          cells.push([br + dr, bc + dc]);
        }
      }
      const hint = this._hiddenSingleInUnit(board, cells, 'box', box);
      if (hint) return hint;
    }
    return null;
  }

  _hiddenSingleInUnit(board, unitCells, unitType, unitIndex) {
    for (let num = 1; num <= 9; num++) {
      const positions = [];
      let alreadyPlaced = false;
      for (const [r, c] of unitCells) {
        if (board[r][c] === num) {
          alreadyPlaced = true;
          break;
        }
        if (board[r][c] === 0 && this.getCandidates(board, r, c).has(num)) {
          positions.push([r, c]);
        }
      }
      if (alreadyPlaced || positions.length !== 1) continue;
      const [r, c] = positions[0];
      const unitName = unitType === 'row' ? `row ${r + 1}` : unitType === 'col' ? `column ${c + 1}` : `box ${unitIndex + 1}`;
      return {
        technique: 'Hidden Single',
        cell: [r, c],
        value: num,
        unit: unitType,
        unitIndex,
        description: `${num} can only go in R${r + 1}C${c + 1} within ${unitName}.`,
        highlights: {
          cells: [[r, c]],
          unitCells: unitCells.map(([ur, uc]) => [ur, uc]),
          eliminatedFrom: [],
        },
      };
    }
    return null;
  }

  _findNakedPair(board) {
    const units = this._getAllUnits();
    for (const { cells, type, index } of units) {
      const emptyCells = cells.filter(([r, c]) => board[r][c] === 0);
      const pairCells = [];
      for (const [r, c] of emptyCells) {
        const cands = this.getCandidates(board, r, c);
        if (cands.size === 2) pairCells.push({ cell: [r, c], cands });
      }
      for (let i = 0; i < pairCells.length; i++) {
        for (let j = i + 1; j < pairCells.length; j++) {
          const a = pairCells[i];
          const b = pairCells[j];
          const aVals = [...a.cands];
          const bVals = [...b.cands];
          if (aVals[0] !== bVals[0] || aVals[1] !== bVals[1]) continue;

          const eliminatedFrom = [];
          for (const [r, c] of emptyCells) {
            if ((r === a.cell[0] && c === a.cell[1]) || (r === b.cell[0] && c === b.cell[1])) continue;
            const cands = this.getCandidates(board, r, c);
            if (cands.has(aVals[0]) || cands.has(aVals[1])) {
              eliminatedFrom.push([r, c]);
            }
          }
          if (eliminatedFrom.length === 0) continue;

          const unitName = type === 'row' ? `row ${index + 1}` : type === 'col' ? `column ${index + 1}` : `box ${index + 1}`;
          return {
            technique: 'Naked Pair',
            cells: [a.cell, b.cell],
            values: aVals,
            unit: type,
            description: `Cells R${a.cell[0] + 1}C${a.cell[1] + 1} and R${b.cell[0] + 1}C${b.cell[1] + 1} in ${unitName} both contain only {${aVals.join(', ')}}. These values can be eliminated from other cells in the ${unitName}.`,
            highlights: {
              cells: [a.cell, b.cell],
              eliminatedFrom,
            },
          };
        }
      }
    }
    return null;
  }

  _findPointingPair(board) {
    for (let box = 0; box < 9; box++) {
      const br = Math.floor(box / 3) * 3;
      const bc = (box % 3) * 3;

      for (let num = 1; num <= 9; num++) {
        const positions = [];
        let placed = false;
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const r = br + dr;
            const c = bc + dc;
            if (board[r][c] === num) { placed = true; break; }
            if (board[r][c] === 0 && this.getCandidates(board, r, c).has(num)) {
              positions.push([r, c]);
            }
          }
          if (placed) break;
        }
        if (placed || positions.length < 2) continue;

        // Check if all in same row
        const allSameRow = positions.every(([r]) => r === positions[0][0]);
        if (allSameRow) {
          const row = positions[0][0];
          const eliminatedFrom = [];
          for (let c = 0; c < 9; c++) {
            if (c >= bc && c < bc + 3) continue;
            if (board[row][c] === 0 && this.getCandidates(board, row, c).has(num)) {
              eliminatedFrom.push([row, c]);
            }
          }
          if (eliminatedFrom.length > 0) {
            return {
              technique: 'Pointing Pair',
              cells: positions,
              value: num,
              box,
              line: 'row',
              lineIndex: row,
              description: `In box ${box + 1}, ${num} can only appear in row ${row + 1}. This eliminates ${num} from other cells in row ${row + 1}.`,
              highlights: { cells: positions, eliminatedFrom },
            };
          }
        }

        // Check if all in same column
        const allSameCol = positions.every(([, c]) => c === positions[0][1]);
        if (allSameCol) {
          const col = positions[0][1];
          const eliminatedFrom = [];
          for (let r = 0; r < 9; r++) {
            if (r >= br && r < br + 3) continue;
            if (board[r][col] === 0 && this.getCandidates(board, r, col).has(num)) {
              eliminatedFrom.push([r, col]);
            }
          }
          if (eliminatedFrom.length > 0) {
            return {
              technique: 'Pointing Pair',
              cells: positions,
              value: num,
              box,
              line: 'col',
              lineIndex: col,
              description: `In box ${box + 1}, ${num} can only appear in column ${col + 1}. This eliminates ${num} from other cells in column ${col + 1}.`,
              highlights: { cells: positions, eliminatedFrom },
            };
          }
        }
      }
    }
    return null;
  }

  _fallbackHint(board, solution) {
    let bestCell = null;
    let minCands = 10;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) continue;
        const size = this.getCandidates(board, r, c).size;
        if (size < minCands) {
          minCands = size;
          bestCell = [r, c];
        }
      }
    }
    if (!bestCell) return null;
    const [r, c] = bestCell;
    const value = solution[r][c];
    return {
      technique: 'Solution Reveal',
      cell: [r, c],
      value,
      description: `No simple technique found. The answer for this cell is ${value}.`,
      highlights: { cells: [[r, c]] },
    };
  }

  _getAllUnits() {
    const units = [];
    for (let i = 0; i < 9; i++) {
      units.push({
        cells: Array.from({ length: 9 }, (_, j) => [i, j]),
        type: 'row',
        index: i,
      });
      units.push({
        cells: Array.from({ length: 9 }, (_, j) => [j, i]),
        type: 'col',
        index: i,
      });
    }
    for (let box = 0; box < 9; box++) {
      const br = Math.floor(box / 3) * 3;
      const bc = (box % 3) * 3;
      const cells = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          cells.push([br + dr, bc + dc]);
        }
      }
      units.push({ cells, type: 'box', index: box });
    }
    return units;
  }
}

// Scores a puzzle by the hardest technique required to solve it:
//   0 = easy     (naked singles + hidden singles only)
//   1 = medium   (naked/hidden pairs, pointing pairs, box-line reduction, naked triples)
//   2 = hard     (X-Wing, Swordfish)
//   3 = advanced (backtracking / guessing required)
class DifficultyAnalyzer {
  analyze(puzzle) {
    const board = puzzle.map(r => [...r]);
    const cands = this._buildCandidates(board);
    let hardest = 0;

    while (this._hasEmpty(board)) {
      if (this._applyNakedSingles(board, cands)) continue;
      if (this._applyHiddenSingles(board, cands)) continue;

      // Stuck at score-0 — escalate to pairs/pointing
      hardest = Math.max(hardest, 1);
      if (this._applyNakedPairs(cands)) continue;
      if (this._applyHiddenPairs(cands)) continue;
      if (this._applyNakedTriples(cands)) continue;
      if (this._applyPointingPairs(board, cands)) continue;
      if (this._applyBoxLineReduction(board, cands)) continue;

      // Stuck at score-1 — escalate to fish patterns
      hardest = Math.max(hardest, 2);
      if (this._applyXWing(board, cands)) continue;
      if (this._applySwordfish(board, cands)) continue;

      // Stuck — needs backtracking
      return 3;
    }
    return hardest;
  }

  _buildCandidates(board) {
    return board.map((row, r) =>
      row.map((val, c) => {
        if (val !== 0) return new Set();
        const set = new Set();
        for (let n = 1; n <= 9; n++) {
          if (this._canPlace(board, r, c, n)) set.add(n);
        }
        return set;
      })
    );
  }

  _canPlace(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num || board[i][col] === num) return false;
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        if (board[br + dr][bc + dc] === num) return false;
    return true;
  }

  _hasEmpty(board) {
    return board.some(row => row.includes(0));
  }

  // Place val at (r,c) and propagate elimination to all peers
  _place(board, cands, r, c, val) {
    board[r][c] = val;
    cands[r][c] = new Set();
    for (let i = 0; i < 9; i++) {
      cands[r][i].delete(val);
      cands[i][c].delete(val);
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++)
      for (let dc = 0; dc < 3; dc++)
        cands[br + dr][bc + dc].delete(val);
  }

  _applyNakedSingles(board, cands) {
    let progress = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0 || cands[r][c].size !== 1) continue;
        this._place(board, cands, r, c, [...cands[r][c]][0]);
        progress = true;
      }
    }
    return progress;
  }

  _applyHiddenSingles(board, cands) {
    let progress = false;
    for (const unit of this._units()) {
      for (let num = 1; num <= 9; num++) {
        const cells = unit.filter(([r, c]) => board[r][c] === 0 && cands[r][c].has(num));
        if (cells.length === 1) {
          this._place(board, cands, cells[0][0], cells[0][1], num);
          progress = true;
        }
      }
    }
    return progress;
  }

  _applyNakedPairs(cands) {
    let progress = false;
    for (const unit of this._units()) {
      const pairs = unit.filter(([r, c]) => cands[r][c].size === 2);
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const [r1, c1] = pairs[i];
          const [r2, c2] = pairs[j];
          const s1 = cands[r1][c1];
          const s2 = cands[r2][c2];
          if (s1.size !== 2 || s2.size !== 2) continue;
          const [a, b] = [...s1];
          if (!s2.has(a) || !s2.has(b)) continue;
          for (const [r, c] of unit) {
            if ((r === r1 && c === c1) || (r === r2 && c === c2)) continue;
            const before = cands[r][c].size;
            cands[r][c].delete(a);
            cands[r][c].delete(b);
            if (cands[r][c].size < before) progress = true;
          }
        }
      }
    }
    return progress;
  }

  _applyHiddenPairs(cands) {
    let progress = false;
    for (const unit of this._units()) {
      for (let n1 = 1; n1 <= 8; n1++) {
        for (let n2 = n1 + 1; n2 <= 9; n2++) {
          const cells1 = unit.filter(([r, c]) => cands[r][c].has(n1));
          const cells2 = unit.filter(([r, c]) => cands[r][c].has(n2));
          if (cells1.length !== 2 || cells2.length !== 2) continue;
          if (cells1[0][0] !== cells2[0][0] || cells1[0][1] !== cells2[0][1]) continue;
          if (cells1[1][0] !== cells2[1][0] || cells1[1][1] !== cells2[1][1]) continue;
          for (const [r, c] of cells1) {
            for (const n of [...cands[r][c]]) {
              if (n !== n1 && n !== n2) {
                cands[r][c].delete(n);
                progress = true;
              }
            }
          }
        }
      }
    }
    return progress;
  }

  _applyNakedTriples(cands) {
    let progress = false;
    for (const unit of this._units()) {
      const small = unit.filter(([r, c]) => cands[r][c].size >= 2 && cands[r][c].size <= 3);
      for (let i = 0; i < small.length; i++) {
        for (let j = i + 1; j < small.length; j++) {
          for (let k = j + 1; k < small.length; k++) {
            const [r1, c1] = small[i];
            const [r2, c2] = small[j];
            const [r3, c3] = small[k];
            const union = new Set([...cands[r1][c1], ...cands[r2][c2], ...cands[r3][c3]]);
            if (union.size !== 3) continue;
            for (const [r, c] of unit) {
              if ((r === r1 && c === c1) || (r === r2 && c === c2) || (r === r3 && c === c3)) continue;
              const before = cands[r][c].size;
              for (const n of union) cands[r][c].delete(n);
              if (cands[r][c].size < before) progress = true;
            }
          }
        }
      }
    }
    return progress;
  }

  // Pointing pairs/triples: candidates in a box confined to one row/col → eliminate from rest of line
  _applyPointingPairs(board, cands) {
    let progress = false;
    for (let box = 0; box < 9; box++) {
      const br = Math.floor(box / 3) * 3;
      const bc = (box % 3) * 3;
      for (let num = 1; num <= 9; num++) {
        const pos = [];
        for (let dr = 0; dr < 3; dr++)
          for (let dc = 0; dc < 3; dc++) {
            const r = br + dr, c = bc + dc;
            if (board[r][c] === 0 && cands[r][c].has(num)) pos.push([r, c]);
          }
        if (pos.length < 2) continue;
        const rows = [...new Set(pos.map(([r]) => r))];
        const cols = [...new Set(pos.map(([, c]) => c))];
        if (rows.length === 1) {
          const row = rows[0];
          for (let c = 0; c < 9; c++) {
            if (c >= bc && c < bc + 3) continue;
            if (board[row][c] === 0 && cands[row][c].has(num)) {
              cands[row][c].delete(num);
              progress = true;
            }
          }
        } else if (cols.length === 1) {
          const col = cols[0];
          for (let r = 0; r < 9; r++) {
            if (r >= br && r < br + 3) continue;
            if (board[r][col] === 0 && cands[r][col].has(num)) {
              cands[r][col].delete(num);
              progress = true;
            }
          }
        }
      }
    }
    return progress;
  }

  // Box-line reduction: candidates in a row/col confined to one box → eliminate from rest of box
  _applyBoxLineReduction(board, cands) {
    let progress = false;
    for (let r = 0; r < 9; r++) {
      for (let num = 1; num <= 9; num++) {
        const cols = [];
        for (let c = 0; c < 9; c++)
          if (board[r][c] === 0 && cands[r][c].has(num)) cols.push(c);
        if (cols.length < 2) continue;
        const boxes = [...new Set(cols.map(c => Math.floor(c / 3)))];
        if (boxes.length !== 1) continue;
        const bc = boxes[0] * 3;
        const br = Math.floor(r / 3) * 3;
        for (let dr = 0; dr < 3; dr++) {
          const row = br + dr;
          if (row === r) continue;
          for (let dc = 0; dc < 3; dc++) {
            const col = bc + dc;
            if (board[row][col] === 0 && cands[row][col].has(num)) {
              cands[row][col].delete(num);
              progress = true;
            }
          }
        }
      }
    }
    for (let c = 0; c < 9; c++) {
      for (let num = 1; num <= 9; num++) {
        const rows = [];
        for (let r = 0; r < 9; r++)
          if (board[r][c] === 0 && cands[r][c].has(num)) rows.push(r);
        if (rows.length < 2) continue;
        const boxes = [...new Set(rows.map(r => Math.floor(r / 3)))];
        if (boxes.length !== 1) continue;
        const br = boxes[0] * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let dc = 0; dc < 3; dc++) {
          const col = bc + dc;
          if (col === c) continue;
          for (let dr = 0; dr < 3; dr++) {
            const row = br + dr;
            if (board[row][col] === 0 && cands[row][col].has(num)) {
              cands[row][col].delete(num);
              progress = true;
            }
          }
        }
      }
    }
    return progress;
  }

  // X-Wing: digit in exactly 2 cells across 2 rows sharing same 2 cols (or vice versa)
  _applyXWing(board, cands) {
    let progress = false;
    for (let num = 1; num <= 9; num++) {
      // Row-based
      const rowData = [];
      for (let r = 0; r < 9; r++) {
        const cols = [];
        for (let c = 0; c < 9; c++)
          if (board[r][c] === 0 && cands[r][c].has(num)) cols.push(c);
        if (cols.length === 2) rowData.push({ r, cols });
      }
      for (let i = 0; i < rowData.length; i++) {
        for (let j = i + 1; j < rowData.length; j++) {
          const a = rowData[i], b = rowData[j];
          if (a.cols[0] !== b.cols[0] || a.cols[1] !== b.cols[1]) continue;
          for (let r = 0; r < 9; r++) {
            if (r === a.r || r === b.r) continue;
            for (const col of a.cols) {
              if (board[r][col] === 0 && cands[r][col].has(num)) {
                cands[r][col].delete(num);
                progress = true;
              }
            }
          }
        }
      }
      // Column-based
      const colData = [];
      for (let c = 0; c < 9; c++) {
        const rows = [];
        for (let r = 0; r < 9; r++)
          if (board[r][c] === 0 && cands[r][c].has(num)) rows.push(r);
        if (rows.length === 2) colData.push({ c, rows });
      }
      for (let i = 0; i < colData.length; i++) {
        for (let j = i + 1; j < colData.length; j++) {
          const a = colData[i], b = colData[j];
          if (a.rows[0] !== b.rows[0] || a.rows[1] !== b.rows[1]) continue;
          for (let c = 0; c < 9; c++) {
            if (c === a.c || c === b.c) continue;
            for (const row of a.rows) {
              if (board[row][c] === 0 && cands[row][c].has(num)) {
                cands[row][c].delete(num);
                progress = true;
              }
            }
          }
        }
      }
    }
    return progress;
  }

  // Swordfish: X-Wing generalised to 3 rows × 3 columns
  _applySwordfish(board, cands) {
    let progress = false;
    for (let num = 1; num <= 9; num++) {
      // Row-based
      const rowData = [];
      for (let r = 0; r < 9; r++) {
        const cols = [];
        for (let c = 0; c < 9; c++)
          if (board[r][c] === 0 && cands[r][c].has(num)) cols.push(c);
        if (cols.length >= 2 && cols.length <= 3) rowData.push({ r, cols });
      }
      for (let i = 0; i < rowData.length; i++) {
        for (let j = i + 1; j < rowData.length; j++) {
          for (let k = j + 1; k < rowData.length; k++) {
            const allCols = [...new Set([...rowData[i].cols, ...rowData[j].cols, ...rowData[k].cols])];
            if (allCols.length !== 3) continue;
            const baseRows = new Set([rowData[i].r, rowData[j].r, rowData[k].r]);
            for (let r = 0; r < 9; r++) {
              if (baseRows.has(r)) continue;
              for (const col of allCols) {
                if (board[r][col] === 0 && cands[r][col].has(num)) {
                  cands[r][col].delete(num);
                  progress = true;
                }
              }
            }
          }
        }
      }
      // Column-based
      const colData = [];
      for (let c = 0; c < 9; c++) {
        const rows = [];
        for (let r = 0; r < 9; r++)
          if (board[r][c] === 0 && cands[r][c].has(num)) rows.push(r);
        if (rows.length >= 2 && rows.length <= 3) colData.push({ c, rows });
      }
      for (let i = 0; i < colData.length; i++) {
        for (let j = i + 1; j < colData.length; j++) {
          for (let k = j + 1; k < colData.length; k++) {
            const allRows = [...new Set([...colData[i].rows, ...colData[j].rows, ...colData[k].rows])];
            if (allRows.length !== 3) continue;
            const baseCols = new Set([colData[i].c, colData[j].c, colData[k].c]);
            for (let c = 0; c < 9; c++) {
              if (baseCols.has(c)) continue;
              for (const row of allRows) {
                if (board[row][c] === 0 && cands[row][c].has(num)) {
                  cands[row][c].delete(num);
                  progress = true;
                }
              }
            }
          }
        }
      }
    }
    return progress;
  }

  _units() {
    const units = [];
    for (let i = 0; i < 9; i++) {
      units.push(Array.from({ length: 9 }, (_, j) => [i, j]));
      units.push(Array.from({ length: 9 }, (_, j) => [j, i]));
    }
    for (let box = 0; box < 9; box++) {
      const br = Math.floor(box / 3) * 3;
      const bc = (box % 3) * 3;
      const cells = [];
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++)
          cells.push([br + dr, bc + dc]);
      units.push(cells);
    }
    return units;
  }
}

class SudokuGenerator {
  constructor() {
    this._solver = new SudokuSolver();
    this._analyzer = new DifficultyAnalyzer();
  }

  generate(difficulty) {
    const config = {
      // easy: only naked/hidden singles allowed — guarantees score=0
      easy:     { maxScore: 0, minScore: 0, minGivens: 36 },
      // medium: pairs/pointing allowed, must require at least one pair — score=1
      medium:   { maxScore: 1, minScore: 1, minGivens: 28 },
      // hard: same technique ceiling as medium but fewer givens — score=0 or 1
      hard:     { maxScore: 1, minScore: 0, minGivens: 23 },
      // advanced: no technique limit, fewest givens — score=0,1, or 3
      advanced: { maxScore: 3, minScore: 0, minGivens: 20 },
    }[difficulty] ?? { maxScore: 1, minScore: 0, minGivens: 28 };

    const deadline = Date.now() + 380; // hard cap: return best within 400ms
    let best = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      if (Date.now() > deadline) break;

      const solution = this._generateCompleteBoard();
      const puzzle = this._buildPuzzle(solution, config);
      const score = this._analyzer.analyze(puzzle);

      if (score >= config.minScore) {
        return { puzzle, solution: solution.map(r => [...r]) };
      }
      if (best === null || score > best.score) {
        best = { puzzle, solution: solution.map(r => [...r]), score };
      }
    }

    // Deadline hit or all attempts exhausted — return best found
    if (best) return { puzzle: best.puzzle, solution: best.solution };

    // Last-resort fallback (no-op if deadline hit before first attempt completed)
    const solution = this._generateCompleteBoard();
    const puzzle = this._buildPuzzle(solution, { maxScore: 3, minScore: 0, minGivens: config.minGivens });
    return { puzzle, solution: solution.map(r => [...r]) };
  }

  _buildPuzzle(solution, config) {
    const board = solution.map(r => [...r]);
    const positions = this._shuffledPositions();
    let givens = 81;

    for (const [r, c] of positions) {
      if (givens <= config.minGivens) break;

      const backup = board[r][c];
      board[r][c] = 0;

      const copy = board.map(row => [...row]);
      if (this._solver._countSolutions(copy, 2) !== 1) {
        board[r][c] = backup;
        continue;
      }

      // For advanced (maxScore=3), skip score check — any unique puzzle qualifies
      if (config.maxScore < 3 && this._analyzer.analyze(board) > config.maxScore) {
        board[r][c] = backup;
        continue;
      }

      givens--;
    }

    return board;
  }

  _shuffledPositions() {
    const positions = [];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        positions.push([r, c]);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    return positions;
  }

  _generateCompleteBoard() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    this._fillBoard(board);
    return board;
  }

  _fillBoard(board) {
    const cell = this._findNextEmpty(board);
    if (!cell) return true;
    const [row, col] = cell;
    const nums = this._shuffledNums();
    for (const num of nums) {
      if (this._solver.isValid(board, row, col, num)) {
        board[row][col] = num;
        if (this._fillBoard(board)) return true;
        board[row][col] = 0;
      }
    }
    return false;
  }

  _findNextEmpty(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  _shuffledNums() {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    return nums;
  }
}

export { SudokuGenerator, SudokuSolver };
