# Agents Guide

## Project Overview

A browser-based Sudoku game built with vanilla JavaScript (ES modules), CSS, and HTML. No build step, no frameworks. Designed for GitHub Pages static hosting.

## Architecture

- **`js/sudoku.js`** — Core engine. `SudokuGenerator` creates unique-solution puzzles via backtracking. `SudokuSolver` provides validation, candidate computation, and a hint system that identifies solving techniques (Naked Single, Hidden Single, Naked Pair, Pointing Pair).
- **`js/storage.js`** — `GameStorage` class wrapping localStorage. Handles save/load of in-progress games and completed game history. Notes (Sets) are serialized as arrays.
- **`js/app.js`** — Main controller. Manages game state, DOM rendering, event handling, timer, undo stack, and stats page with Chart.js charts.
- **`css/style.css`** — Single stylesheet with CSS custom properties. Dark mode via `prefers-color-scheme`. Mobile-first responsive design.
- **`index.html`** — Static HTML with all UI shells (board, numpad, toolbar, modals, stats page).

## Conventions

- Pure vanilla JS — no libraries except Chart.js (loaded from CDN on demand)
- ES modules with `import`/`export`
- CSS custom properties for theming (`--bg-primary`, `--text-primary`, `--blue`, etc.)
- Board is a flat grid of 81 `.cell` divs with `data-row` and `data-col` attributes
- Cell-first interaction: select a cell, then tap a number to place it
- Event delegation on `.board` and `.numpad` containers
- State is a plain object on the `SudokuApp` instance — no reactive framework

## Key Behaviors

- Clicking a cell with a number shows the cant-place overlay for that number across the entire board
- Number pad buttons do not persist selection — they act on the currently selected cell
- Hints highlight cells with technique-specific classes: `.hint-cell`, `.hint-unit`, `.hint-eliminated`
- Game auto-saves to localStorage after every action
- Stats page loads Chart.js dynamically only when opened

## Testing

No test framework. To verify the engine:

```bash
node --input-type=module -e "
import { SudokuGenerator, SudokuSolver } from './js/sudoku.js';
const gen = new SudokuGenerator();
const solver = new SudokuSolver();
const { puzzle, solution } = gen.generate('medium');
console.log('Givens:', puzzle.flat().filter(x => x > 0).length);
console.log('Hint:', solver.findHint(puzzle, solution)?.technique);
"
```

To run locally: `python3 -m http.server 8000`
