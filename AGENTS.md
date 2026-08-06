# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

AiKeepTrade is a React SPA (Vite + Tailwind CSS + shadcn/ui) trading journal backed by Firebase (Auth, Firestore, Storage) with Stripe billing via Firebase Cloud Functions.

### Dev environment

- **Node.js 22** is required (matches `functions/package.json` engine constraint).
- Uses **npm** (lockfile: `package-lock.json`). Two install targets: root and `functions/`.
- No Docker, Makefile, or setup scripts exist in this repo.

### Running the app

- `npm run dev` — starts Vite dev server on `http://127.0.0.1:3000`.
- The app requires a `.env` file with `VITE_FIREBASE_*` variables to render (Firebase SDK initializes on load). Without real credentials, use dummy values (see `.env.example`) so the frontend renders public pages (Home, Features, Pricing, About, Contact, Login, Register).
- Authenticated features (trading journal, accounts, strategies, goals, expenses) require a live Firebase project or Firebase Emulators (`firebase emulators:start`).

### Lint / Build / Test

- `npm run lint` — ESLint (flat config in `eslint.config.js`); scopes to `src/components/`, `src/pages/`, `src/Layout.jsx`.
- `npm run build` — Vite production build to `dist/`.
- No automated test suite exists in this repo.

### Firebase Functions

- Located in `functions/`; dependencies installed separately (`cd functions && npm install`).
- Functions handle Stripe checkout/portal/webhook; optional unless testing billing flows.

### Gotchas

- The repo contains `better-sqlite3` and `sqlite3` in root `package.json` dependencies, but the active data layer uses Firestore exclusively (`src/lib/localStorage.js`). These native modules may cause build warnings but are not used at runtime.
- The Vite dev server binds to `127.0.0.1` (not `0.0.0.0`); see `vite.config.js` `server.host`.
- ESLint has a pre-existing unused-import error in `src/pages/Checklist.jsx` (`CardTitle`).
