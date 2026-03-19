import { SudokuGenerator, SudokuSolver } from './sudoku.js';
import { GameStorage } from './storage.js';

class SudokuApp {
  constructor() {
    this.generator = new SudokuGenerator();
    this.solver = new SudokuSolver();
    this.storage = new GameStorage();
    this.state = this._emptyState();
  }

  _emptyState() {
    return {
      puzzle: null,
      solution: null,
      board: null,
      notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set())),
      selectedCell: null,
      difficulty: 'easy',
      elapsed: 0,
      timerInterval: null,
      mistakes: 0,
      hintsUsed: 0,
      overlayEnabled: true,
      history: [],
      notesMode: false,
      gameOver: false,
      activeHint: null,
    };
  }

  init() {
    this._cacheDom();
    this._bindEvents();
    const saved = this.storage.loadGame();
    if (saved) {
      this._restoreGame(saved);
    } else {
      this.newGame(this.state.difficulty);
    }
  }

  _cacheDom() {
    this.dom = {
      board: document.querySelector('.board'),
      numpad: document.querySelector('.numpad'),
      timer: document.querySelector('.timer'),
      mistakes: document.querySelector('.mistakes'),
      difficultySelect: document.querySelector('.difficulty-select'),
      newGameBtn: document.querySelector('.new-game-btn'),
      menuBtn: document.querySelector('.menu-btn'),
      hintBtn: document.querySelector('.hint-btn'),
      undoBtn: document.querySelector('.undo-btn'),
      notesBtn: document.querySelector('.notes-btn'),
      clearBtn: document.querySelector('.clear-btn'),
      overlayBtn: document.querySelector('.overlay-btn'),
      hintPanel: document.querySelector('.hint-panel'),
      hintTechnique: document.querySelector('.hint-technique'),
      hintDescription: document.querySelector('.hint-description'),
      hintClose: document.querySelector('.hint-close'),
      hintApply: document.querySelector('.hint-apply'),
      victoryOverlay: document.querySelector('.victory-modal'),
      statsPage: document.querySelector('.stats-page'),
      confirmOverlay: document.querySelector('.confirm-modal'),
    };
  }

  _bindEvents() {
    this.dom.board.addEventListener('click', e => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const row = parseInt(cell.dataset.row);
      const col = parseInt(cell.dataset.col);
      this.selectCell(row, col);
    });

    this.dom.numpad.addEventListener('click', e => {
      const btn = e.target.closest('.num-btn');
      if (!btn) return;
      const num = parseInt(btn.dataset.num);
      this.selectNumber(num);
    });

    this.dom.newGameBtn.addEventListener('click', () => {
      this.newGame(this.dom.difficultySelect.value);
    });

    this.dom.difficultySelect.addEventListener('change', () => {
      this.newGame(this.dom.difficultySelect.value);
    });

    this.dom.menuBtn.addEventListener('click', () => this.showStats());
    this.dom.hintBtn.addEventListener('click', () => this.getHint());
    this.dom.undoBtn.addEventListener('click', () => this.undo());
    this.dom.notesBtn.addEventListener('click', () => this.toggleNotes());
    this.dom.clearBtn.addEventListener('click', () => this.confirmClearBoard());
    this.dom.overlayBtn.addEventListener('click', () => this.toggleOverlay());
    this.dom.hintClose.addEventListener('click', () => this.dismissHint());
    this.dom.hintApply.addEventListener('click', () => this.applyHint());

    document.addEventListener('keydown', e => this._handleKeyboard(e));
  }

  _handleKeyboard(e) {
    if (this.state.gameOver) return;
    if (this.dom.statsPage.style.display === 'block') return;

    const key = e.key;
    if (key >= '1' && key <= '9') {
      e.preventDefault();
      this.selectNumber(parseInt(key));
    } else if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      this.selectNumber(0);
    } else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      this._moveSelection(key);
    } else if (key === 'h' || key === 'H') {
      this.getHint();
    } else if (key === 'n' || key === 'N') {
      this.toggleNotes();
    } else if (key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.undo();
    }
  }

  _moveSelection(direction) {
    let [r, c] = this.state.selectedCell || [4, 4];
    if (direction === 'ArrowUp') r = Math.max(0, r - 1);
    else if (direction === 'ArrowDown') r = Math.min(8, r + 1);
    else if (direction === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (direction === 'ArrowRight') c = Math.min(8, c + 1);
    this.state.selectedCell = [r, c];
    this.render();
  }

  newGame(difficulty) {
    this.stopTimer();
    this.state = this._emptyState();
    this.state.difficulty = difficulty;
    this.dom.difficultySelect.value = difficulty;

    const { puzzle, solution } = this.generator.generate(difficulty);
    this.state.puzzle = puzzle;
    this.state.solution = solution;
    this.state.board = puzzle.map(row => [...row]);

    this.storage.clearGame();
    this.state.activeHint = null;
    this.dom.hintPanel.style.display = 'none';
    this.hideVictory();
    this.hideConfirm();
    this.startTimer();
    this.render();
  }

  _restoreGame(saved) {
    this.state.puzzle = saved.puzzle;
    this.state.solution = saved.solution;
    this.state.board = saved.board;
    this.state.notes = saved.notes || Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    this.state.difficulty = saved.difficulty || 'medium';
    this.state.elapsed = saved.elapsed || 0;
    this.state.mistakes = saved.mistakes || 0;
    this.state.hintsUsed = saved.hintsUsed || 0;
    this.state.history = saved.history || [];
    this.state.notesMode = false;
    this.state.gameOver = false;
    this.dom.difficultySelect.value = this.state.difficulty;
    this.startTimer();
    this.render();
  }

  selectCell(row, col) {
    if (this.state.gameOver) return;
    this.state.selectedCell = [row, col];
    this.render();
  }

  selectNumber(num) {
    if (this.state.gameOver) return;
    if (!this.state.selectedCell) return;

    const [r, c] = this.state.selectedCell;
    if (num === 0) {
      this.eraseCell(r, c);
    } else {
      this._placeOrNote(r, c, num);
    }
    this.render();
  }

  _placeOrNote(row, col, num) {
    if (this.state.puzzle[row][col] !== 0) return;
    if (this.state.notesMode) {
      this.placeNote(row, col, num);
    } else {
      this.placeNumber(row, col, num);
    }
  }

  placeNumber(row, col, num) {
    if (this.state.puzzle[row][col] !== 0) return;
    if (this.state.gameOver) return;

    const oldVal = this.state.board[row][col];
    if (oldVal === num) return;
    if (oldVal !== 0 && oldVal === this.state.solution[row][col]) return;

    this.state.history.push({ row, col, oldVal, newVal: num, type: 'value', oldNotes: [...this.state.notes[row][col]] });
    this.state.board[row][col] = num;
    this.state.notes[row][col].clear();

    if (num !== this.state.solution[row][col]) {
      this.state.mistakes++;
    } else {
      this._removeNoteFromPeers(row, col, num);
    }

    if (this._checkVictory()) {
      this._victory();
      return;
    }
    this._saveState();

    const cellEl = this.dom.board.children[row * 9 + col];
    cellEl.classList.add('pop');
    setTimeout(() => cellEl.classList.remove('pop'), 200);
  }

  _removeNoteFromPeers(row, col, num) {
    for (let i = 0; i < 9; i++) {
      this.state.notes[row][i].delete(num);
      this.state.notes[i][col].delete(num);
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        this.state.notes[r][c].delete(num);
      }
    }
  }

  placeNote(row, col, num) {
    if (this.state.puzzle[row][col] !== 0) return;
    if (this.state.board[row][col] !== 0) return;

    const had = this.state.notes[row][col].has(num);
    this.state.history.push({ row, col, type: 'note', num, added: !had });

    if (had) {
      this.state.notes[row][col].delete(num);
    } else {
      this.state.notes[row][col].add(num);
    }
    this._saveState();
  }

  eraseCell(row, col) {
    if (this.state.puzzle[row][col] !== 0) return;
    if (this.state.gameOver) return;

    const oldVal = this.state.board[row][col];
    if (oldVal !== 0 && oldVal === this.state.solution[row][col]) return;
    const oldNotes = [...this.state.notes[row][col]];
    if (oldVal === 0 && oldNotes.length === 0) return;

    this.state.history.push({ row, col, oldVal, newVal: 0, type: 'erase', oldNotes });
    this.state.board[row][col] = 0;
    this.state.notes[row][col].clear();
    this._saveState();
    this.render();
  }

  undo() {
    if (this.state.history.length === 0) return;
    if (this.state.gameOver) return;

    const action = this.state.history.pop();
    if (action.type === 'value' || action.type === 'erase') {
      this.state.board[action.row][action.col] = action.oldVal;
      if (action.oldNotes) {
        this.state.notes[action.row][action.col] = new Set(action.oldNotes);
      }
    } else if (action.type === 'note') {
      if (action.added) {
        this.state.notes[action.row][action.col].delete(action.num);
      } else {
        this.state.notes[action.row][action.col].add(action.num);
      }
    }
    this._saveState();
    this.render();
  }

  confirmClearBoard() {
    if (this.state.gameOver) return;
    this.dom.confirmOverlay.style.display = 'flex';
    this.dom.confirmOverlay.querySelector('.confirm-yes').onclick = () => {
      this.clearBoard();
      this.hideConfirm();
    };
    this.dom.confirmOverlay.querySelector('.confirm-no').onclick = () => {
      this.hideConfirm();
    };
  }

  hideConfirm() {
    this.dom.confirmOverlay.style.display = 'none';
  }

  clearBoard() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.state.puzzle[r][c] === 0) {
          this.state.board[r][c] = 0;
          this.state.notes[r][c].clear();
        }
      }
    }
    this.state.history = [];
    this._saveState();
    this.render();
  }

  toggleNotes() {
    this.state.notesMode = !this.state.notesMode;
    this.dom.notesBtn.classList.toggle('active', this.state.notesMode);
    this.render();
  }

  toggleOverlay() {
    this.state.overlayEnabled = !this.state.overlayEnabled;
    this.dom.overlayBtn.classList.toggle('active', this.state.overlayEnabled);
    this.render();
  }

  getHint() {
    if (this.state.gameOver) return;
    const hint = this.solver.findHint(this.state.board, this.state.solution);
    if (!hint) return;

    this.state.activeHint = hint;
    this.state.hintsUsed++;
    this.dom.hintPanel.style.display = 'block';
    this.dom.hintTechnique.textContent = hint.technique;
    this.dom.hintDescription.textContent = hint.description;

    if (hint.cell || (hint.technique === 'Naked Pair')) {
      this.dom.hintApply.style.display = hint.cell ? 'inline-flex' : 'none';
    }
    this._saveState();
    this.render();
  }

  applyHint() {
    const hint = this.state.activeHint;
    if (!hint || !hint.cell) return;

    this.state.board[hint.cell[0]][hint.cell[1]] = hint.value;
    this.state.notes[hint.cell[0]][hint.cell[1]].clear();
    this._removeNoteFromPeers(hint.cell[0], hint.cell[1], hint.value);

    this.dismissHint();

    if (this._checkVictory()) {
      this._victory();
      return;
    }
    this._saveState();
    this.render();
  }

  dismissHint() {
    this.state.activeHint = null;
    this.dom.hintPanel.style.display = 'none';
    this.render();
  }

  // --- Timer ---
  startTimer() {
    this.stopTimer();
    const startTime = Date.now() - this.state.elapsed * 1000;
    this.state.timerInterval = setInterval(() => {
      this.state.elapsed = Math.floor((Date.now() - startTime) / 1000);
      this.dom.timer.textContent = this._formatTime(this.state.elapsed);
    }, 1000);
    this.dom.timer.textContent = this._formatTime(this.state.elapsed);
  }

  stopTimer() {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
      this.state.timerInterval = null;
    }
  }

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // --- Victory / Game Over ---
  _checkVictory() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.state.board[r][c] !== this.state.solution[r][c]) return false;
      }
    }
    return true;
  }

  _victory() {
    this.state.gameOver = true;
    this.stopTimer();
    this.storage.clearGame();
    this.storage.recordComplete({
      difficulty: this.state.difficulty,
      time: this.state.elapsed,
      mistakes: this.state.mistakes,
      hintsUsed: this.state.hintsUsed,
      date: new Date().toISOString(),
      completed: true,
    });
    this._showVictoryModal();
  }

  _gameOver() {
    this.state.gameOver = true;
    this.stopTimer();
    this.storage.clearGame();
    this.storage.recordComplete({
      difficulty: this.state.difficulty,
      time: this.state.elapsed,
      mistakes: this.state.mistakes,
      hintsUsed: this.state.hintsUsed,
      date: new Date().toISOString(),
      completed: false,
    });
    this._showGameOverModal();
  }

  _showVictoryModal() {
    const overlay = this.dom.victoryOverlay;
    overlay.style.display = 'flex';
    overlay.querySelector('.victory-time').textContent = this._formatTime(this.state.elapsed);
    overlay.querySelector('.victory-mistakes').textContent = this.state.mistakes;
    overlay.querySelector('.victory-hints').textContent = this.state.hintsUsed;
    overlay.querySelector('.victory-difficulty').textContent = this.state.difficulty.charAt(0).toUpperCase() + this.state.difficulty.slice(1);

    overlay.querySelector('.victory-new-game').onclick = () => {
      this.hideVictory();
      this.newGame(this.state.difficulty);
    };
    overlay.querySelector('.victory-stats').onclick = () => {
      this.hideVictory();
      this.showStats();
    };
  }

  _showGameOverModal() {
    const overlay = this.dom.victoryOverlay;
    overlay.style.display = 'flex';
    overlay.querySelector('.victory-title').textContent = 'Game Over';
    overlay.querySelector('.victory-title').style.color = 'var(--red)';
    overlay.querySelector('.victory-subtitle').textContent = 'Too many mistakes!';
    overlay.querySelector('.victory-time').textContent = this._formatTime(this.state.elapsed);
    overlay.querySelector('.victory-mistakes').textContent = this.state.mistakes;
    overlay.querySelector('.victory-hints').textContent = this.state.hintsUsed;
    overlay.querySelector('.victory-difficulty').textContent = this.state.difficulty.charAt(0).toUpperCase() + this.state.difficulty.slice(1);

    overlay.querySelector('.victory-new-game').onclick = () => {
      this.hideVictory();
      this.newGame(this.state.difficulty);
    };
    overlay.querySelector('.victory-stats').onclick = () => {
      this.hideVictory();
      this.showStats();
    };
  }

  hideVictory() {
    this.dom.victoryOverlay.style.display = 'none';
    const titleEl = this.dom.victoryOverlay.querySelector('.victory-title');
    titleEl.textContent = 'Puzzle Complete!';
    titleEl.style.color = '';
    this.dom.victoryOverlay.querySelector('.victory-subtitle').textContent = 'Great job!';
  }

  // --- Stats ---
  showStats() {
    const page = this.dom.statsPage;
    page.style.display = 'block';
    const stats = this.storage.getStats();
    this._renderStats(stats);

    page.querySelector('.stats-back-btn').onclick = () => this.hideStats();
  }

  hideStats() {
    this.dom.statsPage.style.display = 'none';
  }

  _renderStats(stats) {
    const page = this.dom.statsPage;

    page.querySelector('.stat-total-games').textContent = stats.totalGames;
    page.querySelector('.stat-win-rate').textContent = stats.totalGames ? Math.round((stats.totalWins / stats.totalGames) * 100) + '%' : '—';
    page.querySelector('.stat-best-streak').textContent = stats.streaks.best;
    page.querySelector('.stat-current-streak').textContent = stats.streaks.current;

    this._renderCharts(stats);
    this._renderHistory(stats.recentGames);
  }

  _renderCharts(stats) {
    if (this._charts) {
      this._charts.forEach(c => c.destroy());
    }
    this._charts = [];

    const page = this.dom.statsPage;

    const barContainer = page.querySelector('.chart-avg-time');
    const doughnutContainer = page.querySelector('.chart-distribution');
    const lineContainer = page.querySelector('.chart-trend');

    barContainer.innerHTML = '<canvas id="chartAvgTime"></canvas>';
    doughnutContainer.innerHTML = '<canvas id="chartDistribution"></canvas>';
    lineContainer.innerHTML = '<canvas id="chartTrend"></canvas>';

    const loadChart = () => {
      const style = getComputedStyle(document.documentElement);
      const textSec = style.getPropertyValue('--text-secondary').trim() || '#5F5E5A';
      const borderDef = style.getPropertyValue('--border-thin').trim() || '#d0d0d0';

      const diffs = ['easy', 'medium', 'hard', 'advanced'];
      const diffColors = ['#1D9E75', '#378ADD', '#BA7517', '#E24B4A'];

      const avgTimes = diffs.map(d => {
        const s = stats.byDifficulty[d];
        return s && s.avgTime ? Math.round(s.avgTime) : 0;
      });

      this._charts.push(new Chart(document.getElementById('chartAvgTime').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Easy', 'Medium', 'Hard', 'Advanced'],
          datasets: [{
            label: 'Avg Time (s)',
            data: avgTimes,
            backgroundColor: diffColors,
            borderRadius: 4,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textSec, font: { size: 12 } }, border: { color: borderDef } },
            y: { grid: { color: borderDef }, ticks: { color: textSec, font: { size: 12 } }, border: { display: false } }
          }
        }
      }));

      const played = diffs.map(d => stats.byDifficulty[d]?.played || 0);
      this._charts.push(new Chart(document.getElementById('chartDistribution').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Easy', 'Medium', 'Hard', 'Advanced'],
          datasets: [{
            data: played,
            backgroundColor: diffColors,
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: { legend: { position: 'bottom', labels: { color: textSec, font: { size: 12 }, padding: 12 } } }
        }
      }));

      const recent = stats.recentGames.filter(g => g.completed).slice(0, 20);
      if (recent.length > 1) {
        this._charts.push(new Chart(document.getElementById('chartTrend').getContext('2d'), {
          type: 'line',
          data: {
            labels: recent.map((_, i) => `#${i + 1}`),
            datasets: [{
              label: 'Solve Time (s)',
              data: recent.map(g => g.time),
              borderColor: '#7F77DD',
              backgroundColor: 'rgba(127,119,221,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointBackgroundColor: '#7F77DD',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: textSec, font: { size: 11 } }, border: { color: borderDef } },
              y: { grid: { color: borderDef }, ticks: { color: textSec, font: { size: 11 } }, border: { display: false } }
            }
          }
        }));
      }
    };

    if (window.Chart) {
      loadChart();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      script.onload = loadChart;
      document.head.appendChild(script);
    }
  }

  _renderHistory(games) {
    const container = this.dom.statsPage.querySelector('.stats-history');
    if (games.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;text-align:center;padding:20px;">No games played yet</p>';
      return;
    }
    container.innerHTML = games.map(g => {
      const date = new Date(g.date);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const result = g.completed ? '' : ' (gave up)';
      return `<div class="history-item">
        <span class="difficulty-badge ${g.difficulty}">${g.difficulty}</span>
        <div class="history-details">
          <div class="history-time">${this._formatTime(g.time)}${result}</div>
          <div class="history-mistakes">${g.mistakes} mistakes, ${g.hintsUsed} hints</div>
        </div>
        <div class="history-date">${dateStr}</div>
      </div>`;
    }).join('');
  }

  // --- Save ---
  _saveState() {
    this.storage.saveGame({
      puzzle: this.state.puzzle,
      solution: this.state.solution,
      board: this.state.board,
      notes: this.state.notes,
      difficulty: this.state.difficulty,
      elapsed: this.state.elapsed,
      mistakes: this.state.mistakes,
      hintsUsed: this.state.hintsUsed,
      history: this.state.history,
    });
  }

  // --- Render ---
  render() {
    if (!this.state.board) return;
    this._renderBoard();
    this._renderNumpad();
    this._renderMistakes();
  }

  _renderBoard() {
    const { board, puzzle, solution, selectedCell, selectedNumber, activeHint, notes } = this.state;
    const cells = this.dom.board.children;

    const selRow = selectedCell ? selectedCell[0] : -1;
    const selCol = selectedCell ? selectedCell[1] : -1;
    const selBox = selectedCell ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1;
    const selVal = selectedCell ? board[selRow][selCol] : 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        const cell = cells[idx];
        const val = board[r][c];
        const isGiven = puzzle[r][c] !== 0;
        const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);

        cell.className = 'cell';

        if (isGiven) {
          cell.classList.add('given');
        } else if (val !== 0) {
          cell.classList.add('user');
          if (val !== solution[r][c]) {
            cell.classList.add('error');
          }
        }

        if (selectedCell) {
          if (r === selRow && c === selCol) {
            cell.classList.add('selected');
          } else if (r === selRow || c === selCol || box === selBox) {
            cell.classList.add('highlighted');
          }
        }

        if (this.state.overlayEnabled) {
          const overlayNum = selVal || 0;
          if (overlayNum > 0) {
            if (val === overlayNum && !(r === selRow && c === selCol)) {
              cell.classList.add('same-number');
            } else if (val !== overlayNum && (val !== 0 || !this.solver.isValid(board, r, c, overlayNum))) {
              cell.classList.add('cant-place');
            }
          }
        }

        if (activeHint) {
          const hl = activeHint.highlights;
          if (hl.cells && hl.cells.some(([hr, hc]) => hr === r && hc === c)) {
            cell.classList.add('hint-cell');
          }
          if (hl.unitCells && hl.unitCells.some(([hr, hc]) => hr === r && hc === c)) {
            cell.classList.add('hint-unit');
          }
          if (hl.eliminatedFrom && hl.eliminatedFrom.some(([hr, hc]) => hr === r && hc === c)) {
            cell.classList.add('hint-eliminated');
          }
        }

        if (val !== 0) {
          cell.textContent = val;
        } else if (notes[r][c].size > 0) {
          cell.innerHTML = '<div class="notes">' +
            [1,2,3,4,5,6,7,8,9].map(n =>
              `<span class="note">${notes[r][c].has(n) ? n : ''}</span>`
            ).join('') + '</div>';
        } else {
          cell.textContent = '';
        }
      }
    }
  }

  _renderNumpad() {
    const { board } = this.state;
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] > 0) counts[board[r][c]]++;
      }
    }

    const btns = this.dom.numpad.children;
    for (let i = 0; i < btns.length; i++) {
      const btn = btns[i];
      const num = parseInt(btn.dataset.num);
      if (num === 0) {
        btn.classList.remove('active', 'completed');
        continue;
      }
      btn.classList.remove('active');
      btn.classList.toggle('completed', counts[num] >= 9);
      const countEl = btn.querySelector('.count');
      if (countEl) {
        const remaining = 9 - counts[num];
        countEl.textContent = remaining > 0 ? remaining : '';
      }
    }
  }

  _renderMistakes() {
    this.dom.mistakes.textContent = `${this.state.mistakes}`;
  }
}

const app = new SudokuApp();
document.addEventListener('DOMContentLoaded', () => app.init());
