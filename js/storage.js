const CURRENT_KEY = 'sudoku_current';
const HISTORY_KEY = 'sudoku_history';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'advanced'];

function emptyDifficultyStats() {
  return { played: 0, won: 0, bestTime: null, avgTime: 0, totalMistakes: 0, totalHints: 0, times: [], currentStreak: 0, bestStreak: 0 };
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
    history.push(result);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // storage full or unavailable
    }
  }

  getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
      diff.totalMistakes += game.mistakes || 0;
      diff.totalHints += game.hintsUsed || 0;
      totalMistakes += game.mistakes || 0;
      totalHints += game.hintsUsed || 0;
      totalTime += game.time || 0;

      if (game.completed) {
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
      if (game.completed) {
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
      byDifficulty,
      recentGames: history.slice(-20).reverse(),
      streaks: { current: currentStreak, best: bestStreak },
      averageMistakes: totalGames ? totalMistakes / totalGames : 0,
      averageHints: totalGames ? totalHints / totalGames : 0,
    };
  }
}
