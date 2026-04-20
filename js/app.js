import { SudokuGenerator, SudokuSolver } from './sudoku.js';
import { GameStorage } from './storage.js';

class SudokuApp {
  constructor() {
    this.generator = new SudokuGenerator();
    this.solver = new SudokuSolver();
    this.storage = new GameStorage();
    this.state = this._emptyState();
    this._lastNumTapInfo = null;
  }

  _emptyState() {
    return {
      puzzle: null,
      solution: null,
      board: null,
      notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set())),
      selectedCell: null,
      lockedNumber: null,
      activeNumber: null,
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
    this._setupViewportHeight();
    const saved = this.storage.loadGame();
    if (saved) {
      this._restoreGame(saved);
    } else {
      this.newGame(this.state.difficulty);
    }
  }

  _setupViewportHeight() {
    const setHeight = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
    };
    setHeight();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setHeight);
    } else {
      window.addEventListener('resize', setHeight);
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

    let _numpadTouchFired = false;
    this.dom.numpad.addEventListener('touchend', e => {
      const btn = e.target.closest('.num-btn');
      if (!btn) return;
      e.preventDefault(); // blocks double-tap zoom and the synthesized click
      _numpadTouchFired = true;
      setTimeout(() => { _numpadTouchFired = false; }, 500);
      const num = parseInt(btn.dataset.num);
      this._handleNumpadTap(num);
    }, { passive: false });

    this.dom.numpad.addEventListener('click', e => {
      if (_numpadTouchFired) return; // already handled by touchend
      const btn = e.target.closest('.num-btn');
      if (!btn) return;
      const num = parseInt(btn.dataset.num);
      this._handleNumpadTap(num);
    });

    this.dom.newGameBtn.addEventListener('click', () => {
      this.newGame(this.dom.difficultySelect.value);
    });

    this.dom.difficultySelect.addEventListener('change', () => {
      this.newGame(this.dom.difficultySelect.value);
    });

    this.dom.menuBtn.addEventListener('click', () => this.showStats());
    this.dom.hintBtn.addEventListener('click', () => { this._clearLock(); this.getHint(); });
    this.dom.undoBtn.addEventListener('click', () => { this._clearLock(); this.undo(); });
    this.dom.notesBtn.addEventListener('click', () => { this._clearLock(); this.toggleNotes(); });
    this.dom.clearBtn.addEventListener('click', () => { this._clearLock(); this.confirmClearBoard(); });
    this.dom.overlayBtn.addEventListener('click', () => { this._clearLock(); this.toggleOverlay(); });
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
      this._clearLock();
      this.selectNumber(parseInt(key));
    } else if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      this._clearLock();
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
    this._lastNumTapInfo = null;
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
    this.state.notesMode = saved.notesMode || false;
    this.state.overlayEnabled = saved.overlayEnabled !== undefined ? saved.overlayEnabled : true;
    this.state.gameOver = false;
    this.dom.difficultySelect.value = this.state.difficulty;
    this.dom.notesBtn.classList.toggle('active', this.state.notesMode);
    this.dom.overlayBtn.classList.toggle('active', this.state.overlayEnabled);
    this.startTimer();
    this.render();
  }

  selectCell(row, col) {
    if (this.state.gameOver) return;
    this.state.selectedCell = [row, col];
    if (this.state.lockedNumber !== null) {
      const cellVal = this.state.board[row][col];
      const isGiven = this.state.puzzle[row][col] !== 0;
      const isCorrectlyFilled = cellVal !== 0 && cellVal === this.state.solution[row][col];
      if (isGiven || isCorrectlyFilled) {
        // Cell can't be filled — release lock so overlay shows this cell's number
        this.state.lockedNumber = null;
        this.state.activeNumber = null;
      } else {
        this._placeOrNote(row, col, this.state.lockedNumber);
        this._checkAndReleaseLock();
      }
    }
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

  _handleNumpadTap(num) {
    if (this.state.gameOver) return;
    const now = Date.now();

    if (num === 0) {
      this._clearLock();
      this.selectNumber(0);
      return;
    }

    // Double-tap detection: same number tapped within 300ms
    if (this._lastNumTapInfo &&
        this._lastNumTapInfo.num === num &&
        now - this._lastNumTapInfo.time < 300) {
      this._lastNumTapInfo = null;
      if (this.state.lockedNumber === num) {
        this._clearLock();
      } else {
        this._setLock(num);
      }
      return;
    }

    this._lastNumTapInfo = { num, time: now };
    this.state.activeNumber = num; // set before any render so overlay is correct

    // Single tap while a different number is locked → release lock and use new number
    if (this.state.lockedNumber !== null && this.state.lockedNumber !== num) {
      this._clearLock();
    }

    // Single tap on the locked number → release lock and clear active number
    if (this.state.lockedNumber === num) {
      this.state.activeNumber = null;
      this._clearLock();
      return;
    }

    this.selectNumber(num);
  }

  _setLock(num) {
    this.state.lockedNumber = num;
    this.state.activeNumber = num;
    this.render();
  }

  _clearLock() {
    if (this.state.lockedNumber === null) return;
    this.state.lockedNumber = null;
    this.render();
  }

  _checkAndReleaseLock() {
    if (this.state.lockedNumber === null) return;
    const num = this.state.lockedNumber;
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.state.board[r][c] === num && this.state.solution[r][c] === num) count++;
      }
    }
    if (count >= 9) {
      this.state.lockedNumber = null;
      this.state.activeNumber = null;
    }
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
      this._vibrate([50, 30, 50]);
    } else {
      this._removeNoteFromPeers(row, col, num);
      this._vibrate(10);
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

  _vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
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

    const [r, c] = hint.cell;
    this.state.history.push({ row: r, col: c, oldVal: this.state.board[r][c], newVal: hint.value, type: 'value', oldNotes: [...this.state.notes[r][c]] });
    this.state.board[r][c] = hint.value;
    this.state.notes[r][c].clear();
    this._removeNoteFromPeers(r, c, hint.value);

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

  _randomVictoryMessage() {
    const messages = [
      { title: 'Puzzle Complete! 🎉', subtitle: 'You crushed it!' },
      { title: 'Brilliant! 🧠✨', subtitle: 'That was impressive!' },
      { title: 'Nailed It! 🔥', subtitle: "You're on fire!" },
      { title: 'Well Done! 🏆', subtitle: 'Champion-level solving!' },
      { title: 'Amazing! 🌟', subtitle: 'Your brain is a machine!' },
      { title: 'Victory! 💪', subtitle: 'Nothing can stop you!' },
      { title: 'Perfection! 👏', subtitle: 'Sudoku master at work!' },
      { title: 'You Did It! 🥳', subtitle: 'Time to celebrate!' },
      { title: 'Genius Move! 🎯', subtitle: 'Every number in its place!' },
      { title: 'Unstoppable! 🚀', subtitle: 'Ready for the next challenge?' },
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  _showVictoryModal() {
    const overlay = this.dom.victoryOverlay;
    const msg = this._randomVictoryMessage();
    overlay.style.display = 'flex';
    overlay.querySelector('.victory-title').textContent = msg.title;
    overlay.querySelector('.victory-subtitle').textContent = msg.subtitle;
    overlay.querySelector('.victory-time').textContent = this._formatTime(this.state.elapsed);
    overlay.querySelector('.victory-mistakes').textContent = this.state.mistakes;
    overlay.querySelector('.victory-hints').textContent = this.state.hintsUsed;
    overlay.querySelector('.victory-difficulty').textContent = this.state.difficulty.charAt(0).toUpperCase() + this.state.difficulty.slice(1);

    overlay.querySelector('.victory-new-game').onclick = () => {
      this.hideVictory();
      this.newGame(this.state.difficulty);
    };
    overlay.querySelector('.victory-view-stats').onclick = () => {
      this.hideVictory();
      this.showStats();
    };
  }

  _showGameOverModal() {
    const overlay = this.dom.victoryOverlay;
    overlay.style.display = 'flex';
    overlay.querySelector('.victory-title').textContent = 'Game Over 😵';
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
    overlay.querySelector('.victory-view-stats').onclick = () => {
      this.hideVictory();
      this.showStats();
    };
  }

  hideVictory() {
    this.dom.victoryOverlay.style.display = 'none';
    const titleEl = this.dom.victoryOverlay.querySelector('.victory-title');
    titleEl.style.color = '';
  }

  // --- Stats ---
  showStats() {
    const page = this.dom.statsPage;
    page.style.display = 'block';
    const stats = this.storage.getStats();
    this._renderStats(stats);

    page.querySelector('.stats-back-btn').onclick = () => this.hideStats();

    page.querySelector('.export-data-btn').onclick = () => this._exportData();
    page.querySelector('.import-data-btn').onclick = () => {
      page.querySelector('.import-file-input').click();
    };
    page.querySelector('.import-file-input').onchange = (e) => this._importData(e);
    page.querySelector('.refresh-app-btn').onclick = () => this._forceRefresh();
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
    if (this._dailyChart) {
      this._dailyChart.destroy();
      this._dailyChart = null;
    }
    this._charts = [];

    const page = this.dom.statsPage;

    page.querySelector('.chart-analysis').innerHTML = '<canvas id="chartAnalysis"></canvas>';
    page.querySelector('.chart-distribution').innerHTML = '<canvas id="chartDistribution"></canvas>';

    const loadCharts = () => {
      const style = getComputedStyle(document.documentElement);
      const textSec = style.getPropertyValue('--text-secondary').trim() || '#888';
      const borderDef = style.getPropertyValue('--border-thin').trim() || '#d0d0d0';

      const diffs = ['easy', 'medium', 'hard', 'advanced'];
      const diffLabels = ['Easy', 'Medium', 'Hard', 'Advanced'];
      const diffColors = ['#4ade80', '#facc15', '#fb923c', '#f87171'];

      const completed = stats.recentGames.filter(g => g.completed);

      const colorWithAlpha = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
      };
      const alphaForCount = n => [0.3, 0.5, 0.65, 0.8, 0.95][Math.min(n - 1, 4)];

      const makeColumn = (games, xPos, baseColor, yAxisID, style = 'circle') => {
        const freq = {};
        games.forEach(g => {
          const y = yAxisID === 'yTime' ? +(g.time / 60).toFixed(2) : (g.mistakes || 0);
          freq[y] = (freq[y] || 0) + 1;
        });
        const pts = Object.entries(freq).map(([y, cnt]) => ({ x: xPos, y: +y, cnt }));
        return {
          data: pts.map(p => ({ x: p.x, y: p.y })),
          backgroundColor: pts.map(p => colorWithAlpha(baseColor, alphaForCount(p.cnt))),
          pointRadius: 5,
          pointHoverRadius: 7,
          pointStyle: style,
          pointBorderWidth: 0,
          yAxisID,
        };
      };

      // Time columns at x=i, mistakes columns at x=i+0.5
      const timeDatasets = diffs.map((d, i) => ({
        label: diffLabels[i],
        ...makeColumn(completed.filter(g => g.difficulty === d), i, diffColors[i], 'yTime'),
      }));

      const mistakeDatasets = diffs.map((d, i) => ({
        label: diffLabels[i] + '_m',
        ...makeColumn(completed.filter(g => g.difficulty === d), i + 0.5, diffColors[i], 'yMistakes', 'crossRot'),
      }));

      this._charts.push(new Chart(document.getElementById('chartAnalysis').getContext('2d'), {
        type: 'scatter',
        data: { datasets: [...timeDatasets, ...mistakeDatasets] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                filter: item => !item.text.endsWith('_m'),
                color: textSec, font: { size: 12 }, padding: 10, boxWidth: 12,
              },
            },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const isMistakes = ctx.dataset.yAxisID === 'yMistakes';
                  const name = ctx.dataset.label.replace('_m', '');
                  return isMistakes
                    ? `${name}: ${ctx.parsed.y} mistakes`
                    : `${name}: ${ctx.parsed.y.toFixed(1)} min`;
                },
              },
            },
          },
          scales: {
            x: {
              min: -0.5, max: 4.0,
              afterBuildTicks(axis) {
                axis.ticks = [0, 1, 2, 3].map(v => ({ value: v }));
              },
              ticks: {
                color: textSec, font: { size: 11 },
                callback: v => ['Easy', 'Med', 'Hard', 'Adv'][Math.round(v)] || '',
              },
              grid: { display: false },
              border: { color: borderDef },
            },
            yTime: {
              position: 'left',
              title: { display: true, text: 'min', color: textSec, font: { size: 11 } },
              ticks: { color: textSec, font: { size: 11 } },
              grid: { color: borderDef },
              border: { display: false },
            },
            yMistakes: {
              position: 'right',
              min: 0,
              title: { display: true, text: 'mistakes', color: textSec, font: { size: 11 } },
              ticks: { color: textSec, font: { size: 11 }, stepSize: 1 },
              grid: { display: false },
              border: { display: false },
            },
          },
        },
      }));

      // Doughnut: distribution by difficulty
      const played = diffs.map(d => stats.byDifficulty[d]?.played || 0);
      this._charts.push(new Chart(document.getElementById('chartDistribution').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: diffLabels,
          datasets: [{ data: played, backgroundColor: diffColors, borderWidth: 0 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: { legend: { position: 'bottom', labels: { color: textSec, font: { size: 12 }, padding: 12 } } },
        },
      }));

      // Toggle handlers and initial daily chart
      page.querySelector('.toggle-week').onclick = () => {
        page.querySelector('.toggle-week').classList.add('active');
        page.querySelector('.toggle-month').classList.remove('active');
        this._renderDailyChart(stats, 'week');
      };
      page.querySelector('.toggle-month').onclick = () => {
        page.querySelector('.toggle-month').classList.add('active');
        page.querySelector('.toggle-week').classList.remove('active');
        this._renderDailyChart(stats, 'month');
      };
      this._renderDailyChart(stats, 'week');
    };

    if (window.Chart) {
      loadCharts();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      script.onload = loadCharts;
      document.head.appendChild(script);
    }
  }

  _renderDailyChart(stats, period) {
    const container = this.dom.statsPage.querySelector('.chart-daily');
    container.innerHTML = '<canvas id="chartDaily"></canvas>';

    if (!window.Chart) return;

    const style = getComputedStyle(document.documentElement);
    const textSec = style.getPropertyValue('--text-secondary').trim() || '#888';
    const borderDef = style.getPropertyValue('--border-thin').trim() || '#d0d0d0';

    const days = period === 'week' ? 7 : 30;
    const diffs = ['easy', 'medium', 'hard', 'advanced'];
    const diffLabels = ['Easy', 'Medium', 'Hard', 'Advanced'];
    const diffColors = ['#4ade80', '#facc15', '#fb923c', '#f87171'];

    const dateKeys = [];
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateKeys.push(d.toISOString().slice(0, 10));
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }

    const dailyCounts = {};
    for (const key of dateKeys) {
      dailyCounts[key] = { easy: 0, medium: 0, hard: 0, advanced: 0 };
    }
    for (const game of (stats.allGames || [])) {
      if (!game.completed) continue;
      const key = new Date(game.date).toISOString().slice(0, 10);
      if (dailyCounts[key]) dailyCounts[key][game.difficulty] = (dailyCounts[key][game.difficulty] || 0) + 1;
    }

    if (this._dailyChart) {
      this._dailyChart.destroy();
      this._dailyChart = null;
    }

    this._dailyChart = new Chart(document.getElementById('chartDaily').getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: diffs.map((d, i) => ({
          label: diffLabels[i],
          data: dateKeys.map(k => dailyCounts[k][d] || 0),
          backgroundColor: diffColors[i],
          borderRadius: 3,
          borderSkipped: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textSec, font: { size: 12 }, padding: 10, boxWidth: 12 } },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: textSec, font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: period === 'week' ? 7 : 10 },
            border: { color: borderDef },
          },
          y: {
            stacked: true,
            ticks: { color: textSec, font: { size: 11 }, stepSize: 1 },
            grid: { color: borderDef },
            border: { display: false },
          },
        },
      },
    });
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

  // --- Data Management ---
  _exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('sudoku_')) {
        data[key] = JSON.parse(localStorage.getItem(key));
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sudoku-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith('sudoku_')) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }
        this.hideStats();
        const saved = this.storage.loadGame();
        if (saved) {
          this._restoreGame(saved);
        }
      } catch {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  _forceRefresh() {
    if (!confirm('This will clear cached app files and reload. Your game data will be preserved.')) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        const unregisterAll = registrations.map(r => r.unregister());
        return Promise.all(unregisterAll);
      }).then(() => caches.keys()).then(keys => {
        return Promise.all(keys.map(k => caches.delete(k)));
      }).then(() => {
        location.reload(true);
      });
    } else {
      location.reload(true);
    }
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
      notesMode: this.state.notesMode,
      overlayEnabled: this.state.overlayEnabled,
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
    const { board, puzzle, solution, selectedCell, activeHint, notes } = this.state;
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
          const overlayNum = this.state.lockedNumber || this.state.activeNumber || selVal || 0;
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
        btn.classList.remove('active', 'completed', 'locked');
        continue;
      }
      btn.classList.remove('active');
      btn.classList.toggle('completed', counts[num] >= 9);
      btn.classList.toggle('locked', num === this.state.lockedNumber);
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
