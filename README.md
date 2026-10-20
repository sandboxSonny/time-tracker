# Adams Gas Engineers – Time Tracker

A mobile-first time tracker for a single client. Log time against a client with a short description, filter by client and month, and export to CSV. Installable on iPhone as a home-screen app.

**Stack:** React Router 7 (framework mode, SSR) · SQLite (`better-sqlite3`) · Tailwind 4 + daisyUI 5 · TypeScript

## Running locally

```sh
cp .env.example .env   # then edit the values
npm install
npm run dev
```

The dev server doesn't read `.env` on its own, so export the variables first, for example:

```sh
export $(grep -v '^#' .env | xargs) && npm run dev
```

## Environment variables

| Variable         | Required | Description                                                                                           |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `APP_PASSWORD`   | Yes      | The single shared login password.                                                                     |
| `SESSION_SECRET` | Yes      | Random string, 32+ characters (`openssl rand -hex 32`). The app won't start in production without it. |
| `DATABASE_PATH`  | No       | SQLite file location. Defaults to `./data/tracker.db` (`/data/tracker.db` in the Docker image).       |

## Deploying to Railway

Deploy from GitHub or the included `Dockerfile`; both work.

1. Add a **volume** mounted at `/data`. Without it the database is wiped on every deploy.
2. Set `APP_PASSWORD` and `SESSION_SECRET`.
3. Open the HTTPS URL in Safari on iPhone → Share → **Add to Home Screen**.

Changing `SESSION_SECRET` signs everyone out (sessions can't be revoked individually).

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the dev server                |
| `npm run build`     | Production build                    |
| `npm start`         | Serve the production build          |
| `npm run typecheck` | Generate route types and run `tsc`  |
| `npm run lint`      | ESLint (`lint:fix` to auto-fix)     |
| `npm run format`    | Prettier (`format:check` to verify) |

## Project layout

```
app/
  routes/            Pages: login, entries, clients, CSV export, logout
  components/        LogSheet – the "Log time" sheet/modal
  db.server.ts       SQLite schema and queries
  session.server.ts  Password check, session cookie, login rate limiting
  entry.server.tsx   Security headers
  time.ts            Duration parsing/formatting (1h30m, 1:30, 1.5)
public/              Logo, icons, web manifest
```

## Notes

- Auth is a single shared password with a signed cookie (30 days). Login is rate-limited in memory, so the counters reset on restart.
- Back up the SQLite file occasionally (Railway volume backups, or the CSV export).
- Time is stored as whole minutes. Entries can be deleted but not edited.
