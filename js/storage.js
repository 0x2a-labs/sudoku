const CURRENT_KEY = 'sudoku_current';
const HISTORY_KEY = 'sudoku_history';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'advanced'];
const GAME_RESULTS = {
  WON: 'won',
  GAVE_UP: 'gave-up',
  FAILED: 'failed',
};

function emptyDifficultyStats() {
  return { played: 0, won: 0, bestTime: null, avgTime: 0, totalTime: 0, totalMistakes: 0, totalHints: 0, times: [], currentStreak: 0, bestStreak: 0 };
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeHistoryEntry(game) {
  if (!game || typeof game !== 'object') return null;

  let result = game.result;
  if (result !== GAME_RESULTS.WON && result !== GAME_RESULTS.GAVE_UP && result !== GAME_RESULTS.FAILED) {
    if (game.completed === true) {
      result = GAME_RESULTS.WON;
    } else if (game.completed === false) {
      // Legacy builds stored solved puzzles with mistakes as incomplete and never persisted actual give-ups.
      result = GAME_RESULTS.WON;
    } else {
      result = GAME_RESULTS.GAVE_UP;
    }
  }

  return {
    ...game,
    difficulty: DIFFICULTIES.includes(game.difficulty) ? game.difficulty : 'medium',
    time: normalizeNumber(game.time),
    mistakes: normalizeNumber(game.mistakes),
    hintsUsed: normalizeNumber(game.hintsUsed),
    date: typeof game.date === 'string' && game.date ? game.date : '1970-01-01T00:00:00.000Z',
    result,
    completed: result === GAME_RESULTS.WON,
  };
}

function serializeNotes(notes) {
  if (!notes) return null;
  return notes.map(row =>
    row.map(cell =>
      cell ? [...cell] : []
    )
  );
}

function deserializeNotes(notes) {
  if (!notes) return null;
  return notes.map(row =>
    row.map(cell => new Set(cell))
  );
}

export class GameStorage {
  _writeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // storage full or unavailable
    }
  }

  saveGame(gameData) {
    const serialized = {
      ...gameData,
      notes: serializeNotes(gameData.notes),
    };
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(serialized));
    } catch {
      // storage full or unavailable
    }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(CURRENT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      data.notes = deserializeNotes(data.notes);
      return data;
    } catch {
      return null;
    }
  }

  clearGame() {
    try {
      localStorage.removeItem(CURRENT_KEY);
    } catch {
      // ignore
    }
  }

  recordComplete(result) {
    const history = this.getHistory();
    const normalized = normalizeHistoryEntry(result);
    if (!normalized) return;
    history.push(normalized);
    this._writeHistory(history);
  }

  recalculateHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const normalized = parsed.map(normalizeHistoryEntry).filter(Boolean);
      const serialized = JSON.stringify(normalized);
      if (serialized !== raw) {
        this._writeHistory(normalized);
      }

      return normalized;
    } catch {
      return [];
    }
  }

  getHistory() {
    return this.recalculateHistory();
  }

  getStats() {
    const history = this.getHistory();

    const byDifficulty = {};
    for (const d of DIFFICULTIES) {
      byDifficulty[d] = emptyDifficultyStats();
    }

    let totalWins = 0;
    let totalTime = 0;
    let totalMistakes = 0;
    let totalHints = 0;
    let currentStreak = 0;
    let bestStreak = 0;

    for (const game of history) {
      const diff = byDifficulty[game.difficulty] ?? (byDifficulty[game.difficulty] = emptyDifficultyStats());

      diff.played++;
      diff.totalTime += game.time;
      diff.totalMistakes += game.mistakes || 0;
      diff.totalHints += game.hintsUsed || 0;
      totalMistakes += game.mistakes || 0;
      totalHints += game.hintsUsed || 0;
      totalTime += game.time || 0;

      if (game.result === GAME_RESULTS.WON) {
        totalWins++;
        diff.won++;
        diff.times.push(game.time);
        diff.bestTime = diff.bestTime === null ? game.time : Math.min(diff.bestTime, game.time);
        diff.avgTime = diff.times.reduce((a, b) => a + b, 0) / diff.times.length;
        diff.currentStreak++;
        diff.bestStreak = Math.max(diff.bestStreak, diff.currentStreak);
      } else {
        diff.currentStreak = 0;
      }
    }

    // Global streaks (across all difficulties, in order)
    for (const game of history) {
      if (game.result === GAME_RESULTS.WON) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const totalGames = history.length;

    return {
      totalGames,
      totalWins,
      totalTime,
      averageTime: totalGames ? totalTime / totalGames : 0,
      byDifficulty,
      allGames: history,
      recentGames: history.slice(-20).reverse(),
      streaks: { current: currentStreak, best: bestStreak },
      averageMistakes: totalGames ? totalMistakes / totalGames : 0,
      averageHints: totalGames ? totalHints / totalGames : 0,
    };
  }
}
