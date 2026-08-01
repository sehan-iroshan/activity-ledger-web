# Activity Ledger (Web)

A web version of the Activity Ledger desktop app: login, activity tracking with
auto date/time stamping, a searchable register, a dashboard, and user management.

## Run locally

```bash
npm install
npm start
```

Then open **http://localhost:3000**

Default login: `admin` / `admin123`

## Configuration

Optional environment variables:

- `PORT` — port to listen on (default `3000`)
- `SESSION_SECRET` — secret used to sign session cookies. **Set this to a long
  random string in production** (e.g. `openssl rand -hex 32`).

## Data storage

All data is stored as JSON files under `data/` (created automatically on first
run):

- `data/users.json`
- `data/activities.json`
- `data/projects.json` (remembered project names for the New Entry dropdown)

Back up the `data/` folder to back up everything. No external database is
required.

## Deploying

This is a plain Node.js + Express app with no build step, so it runs on almost
any Node host:

1. **Render / Railway / Fly.io / a VPS** — push this folder, set the start
   command to `npm start`, set `SESSION_SECRET` in the environment, and make
   sure the `data/` folder is on a persistent disk/volume (not ephemeral
   storage) so your entries survive restarts and deploys.
2. **Docker** — a minimal `Dockerfile`:

   ```dockerfile
   FROM node:22-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --omit=dev
   COPY . .
   ENV PORT=3000
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

   Mount a volume at `/app/data` so activity data persists across container
   restarts.

3. **Behind a reverse proxy (Nginx/Caddy)** — proxy to `127.0.0.1:3000` and
   terminate HTTPS at the proxy; the app itself just serves plain HTTP.

## Notes on this version vs. the desktop app

- Same feature set: login, roles (Admin/User), New Entry with a remembered
  Project Name dropdown, live date/time stamp, Register with search (date
  range, project, requester, logged-by), row detail view, amend status/
  delivery, delete, CSV export, and a Dashboard with project-wise and
  user-wise Pending/Incomplete/Complete/Cancelled breakdowns.
- Passwords are hashed with bcrypt.
- Sessions are server-side (in-memory by default) via `express-session`. For
  multiple server instances behind a load balancer, swap in a shared session
  store (e.g. `connect-redis`) — the in-memory default only works for a single
  process.
