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

## Zoho Books client import (optional)

The Clients page can connect to Zoho Books with OAuth and copy the names of your active customers into the client list. It only adds names that aren't already there (case-insensitive), so it's safe to run again later. It's read-only: nothing is written back to Zoho.

One-time setup:

1. Open the Zoho API Console for your data centre (e.g. https://api-console.zoho.eu) → **Add Client** → **Server-based Applications**.
2. Set the **Authorized Redirect URI** to `https://<your-app-url>/zoho/callback` (it must match `APP_URL` exactly).
3. Set these environment variables:

   | Variable               | Required   | Description                                                                                                       |
   | ---------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
   | `ZOHO_CLIENT_ID`       | Yes        | From the API Console client. The Zoho section stays hidden until this and the secret are set.                     |
   | `ZOHO_CLIENT_SECRET`   | Yes        | From the same place.                                                                                              |
   | `ZOHO_DC`              | Yes (UK)   | Data centre: `com` (default), `eu`, `in`, `com.au`, `jp`, `ca` or `sa`. UK accounts are usually `eu`.             |
   | `APP_URL`              | Yes (prod) | Public URL of the app, e.g. `https://tracker.up.railway.app` (no trailing slash). Used to build the redirect URI. |
   | `ZOHO_ORGANIZATION_ID` | No         | Only needed if the Zoho account has several organisations; otherwise the first one is used.                       |

4. Open **Clients → Connect Zoho Books**, approve access (scope `ZohoBooks.contacts.READ`), then press **Import from Zoho**.

The refresh token is stored in the SQLite database (the `settings` table). **Disconnect** removes it and revokes it at Zoho. To work locally, add `http://localhost:5173/zoho/callback` as a second redirect URI in the API Console.

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
  zoho.server.ts     Zoho Books client import
  session.server.ts  Password check, session cookie, login rate limiting
  entry.server.tsx   Security headers
  time.ts            Duration parsing/formatting (1h30m, 1:30, 1.5)
public/              Logo, icons, web manifest
```

## Notes

- Auth is a single shared password with a signed cookie (30 days). Login is rate-limited in memory, so the counters reset on restart.
- Back up the SQLite file occasionally (Railway volume backups, or the CSV export).
- The public host must be known at **build** time (`APP_URL` or Railway's `RAILWAY_PUBLIC_DOMAIN`, read in `react-router.config.ts`). Behind Railway's proxy the server sees `http://`, so without it React Router's CSRF origin check rejects every form POST with a 400. If you add or change the domain, redeploy so it rebuilds.
- Time is stored as whole minutes. Entries can be deleted but not edited.

## License

The source code is released under the [MIT License](LICENSE).

**Branding is not open source.** The Adams Gas Engineers name, logo, favicon and icons (everything in `public/` apart from the manifest, plus the branding text in the app) are proprietary to Adams Gas Engineers and may only be used with their authorisation. See [BRANDING.md](BRANDING.md). If you reuse this project, replace them with your own.
