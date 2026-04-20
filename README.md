# Sudoku

A clean, modern Sudoku puzzle game that runs entirely in the browser. Built with vanilla JavaScript — no frameworks, no build step. Hosted on GitHub Pages.

## Features

- **4 difficulty levels** — Easy, Medium, Hard, Advanced
- **New puzzle every refresh** — unique-solution puzzles generated client-side
- **Hint system** — teaches solving techniques (Naked Single, Hidden Single, Naked Pair, Pointing Pair) with visual highlights
- **Number overlay** — click any number on the board to see where it can and can't be placed
- **Notes mode** — pencil marks for candidates
- **Undo** — full undo history
- **Statistics** — solve times, mistake-free win rate, streaks, and charts (Chart.js) stored in localStorage
- **PWA** — installable, works offline via service worker
- **Responsive** — works on desktop and mobile
- **Dark mode** — follows system preference

## How to Play

1. Select an empty cell on the board
2. Tap a number (1–9) to place it
3. Use **Notes** mode to pencil in candidates
4. Use **Hint** to learn a solving technique
5. Use **Undo** to revert mistakes
6. Mistakes are tracked, but they do not end the game
7. Statistics count only mistake-free finishes as wins

## Running Locally

Serve the directory with any static file server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy to GitHub Pages

1. Push to a GitHub repository
2. Go to Settings → Pages
3. Set source to the branch root (`/`)
4. The site will be live at `https://<username>.github.io/<repo>/`

## Project Structure

```
├── index.html          # Main HTML with all UI components
├── css/
│   └── style.css       # Complete stylesheet with dark mode
├── js/
│   ├── sudoku.js       # Puzzle generator, solver, and hint engine
│   ├── storage.js      # localStorage manager for stats
│   └── app.js          # Game controller and UI logic
├── icons/
│   ├── icon.svg        # App icon
│   └── apple-touch-icon.svg
├── manifest.json       # PWA manifest
├── sw.js               # Service worker for offline support
└── LICENSE
```

## Tech Stack

- Vanilla JavaScript (ES modules)
- CSS custom properties with dark mode
- Chart.js (loaded from CDN on demand for stats)
- Service worker for offline/PWA

## License

[MIT](LICENSE)
