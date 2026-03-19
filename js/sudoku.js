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
    const cell = this._findEmptySimple(board);
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

  _findEmptySimple(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
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

class SudokuGenerator {
  constructor() {
    this._solver = new SudokuSolver();
  }

  generate(difficulty) {
    const solution = this._generateCompleteBoard();
    const puzzle = this._removeNumbers(solution, difficulty);
    return {
      puzzle,
      solution: solution.map(row => [...row]),
    };
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

  _removeNumbers(solution, difficulty) {
    const givensRange = {
      easy: [36, 40],
      medium: [30, 35],
      hard: [25, 29],
      advanced: [20, 24],
    };
    const [minGivens, maxGivens] = givensRange[difficulty] || givensRange.medium;
    const targetGivens = minGivens + Math.floor(Math.random() * (maxGivens - minGivens + 1));

    const board = solution.map(row => [...row]);
    const positions = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        positions.push([r, c]);
      }
    }
    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    let givens = 81;
    for (const [r, c] of positions) {
      if (givens <= targetGivens) break;
      const backup = board[r][c];
      board[r][c] = 0;
      const copy = board.map(row => [...row]);
      if (this._solver._countSolutions(copy, 2) !== 1) {
        board[r][c] = backup;
      } else {
        givens--;
      }
    }

    return board;
  }
}

export { SudokuGenerator, SudokuSolver };
