# kritzlboard

A collaborative whiteboard you can host yourself — a lightweight, self-hostable
alternative to tldraw. Create a board, share the link, and everyone on your
network draws together in real time.

## Features

- **Infinite canvas** with pan (space / middle mouse / scroll / hand tool) and
  zoom (Ctrl+scroll, pinch, zoom bar)
- **Tools**: select, hand, freehand pen (pressure-simulated), eraser,
  rectangle, ellipse, line, arrow, text
- **Editing**: move, resize (Shift keeps aspect / axis), multi-select with
  rubber band, duplicate (Ctrl+D), copy/paste, undo/redo (only your own
  changes), style panel (9 colors, fill styles, 3 sizes)
- **Shape labels**: double-click inside a rectangle, ellipse or on a
  line/arrow (or press Enter with one selected) to type centered text; boxes
  grow to fit their label
- **Real-time collaboration**: CRDT-based sync (Yjs) — concurrent edits merge
  without conflicts, offline changes sync on reconnect
- **Presence**: live cursors with names, who's-here avatars, remote selections
- **Persistence**: every board is saved to Postgres and survives restarts
- **Accounts** (via [BetterAuth](https://better-auth.com)): email + password
  sign-in; presence shows your account name. Boards opened while signed in
  are remembered on the account (visible on any device, hidden when signed
  out); anonymous visits stay in the browser's localStorage. Optionally
  require sign-in for all boards (`REQUIRE_AUTH=1`)
- **Self-hosted**: one small Node process serves the app, the auth API and
  the sync websocket; everything is stored in a single Postgres database

## Quick start (development)

```bash
pnpm install
# a Postgres to develop against (or point DATABASE_URL at your own)
podman run -d --name kritzlboard-pg -p 5432:5432 \
  -e POSTGRES_USER=kritzlboard -e POSTGRES_PASSWORD=kritzlboard -e POSTGRES_DB=kritzlboard \
  docker.io/library/postgres:17-alpine
pnpm dev
```

This starts the Vite dev server on [http://localhost:3000](http://localhost:3000)
and the sync/auth server on port 8080 (schema migrations run automatically on
startup). Open the same board URL in two windows to see live collaboration.

## Self-hosting

### Docker (recommended)

```bash
docker compose up -d        # or: podman compose up -d
```

Then open `http://<your-host>:8080`. This starts the app plus a Postgres
container; data lives in the `kritzlboard-pgdata` volume. **Set
`BETTER_AUTH_SECRET` in `docker-compose.yml` to your own random string**
(e.g. `openssl rand -base64 32`).

### Without Docker

Requires Node.js >= 24 (the server runs TypeScript natively) and a Postgres
database.

```bash
pnpm install
pnpm build                  # builds the client into dist/
DATABASE_URL=postgres://… BETTER_AUTH_SECRET=… pnpm start
```

### Configuration

| Env var              | Default   | Description                                                   |
| -------------------- | --------- | ------------------------------------------------------------- |
| `PORT`               | `8080`    | HTTP + websocket port                                         |
| `HOST`               | `::`      | Listen address (dual-stack; falls back to `0.0.0.0` if IPv6 is unavailable) |
| `DATABASE_URL`       | `postgres://kritzlboard:kritzlboard@localhost:5432/kritzlboard` | Postgres connection string (boards + accounts) |
| `BETTER_AUTH_SECRET` | _(unset)_ | Secret for signing auth cookies — set to a long random string in production |
| `REQUIRE_AUTH`       | `0`       | Set to `1` to require sign-in for all boards (websocket rejects anonymous clients, the app redirects to `/login`) |
| `TRUSTED_ORIGINS`    | _(unset)_ | Extra comma-separated origins allowed for auth requests (when serving behind additional hostnames) |
| `DATA_DIR`           | `./data`  | Legacy pre-Postgres board files (`.yjs`); imported into Postgres the first time a board is opened |
| `VITE_SYNC_URL`      | _(unset)_ | Client build-time override for the sync websocket URL. Not needed in the default setup — in production the client connects to `ws(s)://<same-origin>/sync`. |

By default boards are shared by URL: anyone who can reach the server and knows
a board's link can view and edit it, signed in or not. Set `REQUIRE_AUTH=1` to
restrict the whole instance to signed-in users.

## How it works

- **Client**: React + TanStack Router SPA. The canvas is plain SVG; shapes
  live in a Yjs document (`Y.Map` of plain shape objects), so every change is
  a CRDT update. Cursors/selections use the Yjs awareness protocol. Freehand
  strokes are rendered with
  [perfect-freehand](https://github.com/steveruizok/perfect-freehand).
- **Server** (`server/main.ts`): a single Node process that speaks the
  standard [y-websocket](https://github.com/yjs/y-websocket) protocol on
  `/sync/<boardId>`, debounce-saves each board's Yjs state to Postgres,
  handles auth on `/api/auth/*`, and serves the built client with an SPA
  fallback. Rooms are loaded lazily and unloaded (after a final save) when
  the last client leaves.
- **Auth & storage**: [BetterAuth](https://better-auth.com) with the Drizzle
  adapter; boards and auth tables share one Postgres database
  (`server/schema.ts`). Migrations live in `server/drizzle/` (generated with
  `pnpm drizzle-kit generate`) and are applied automatically on server
  startup.

## Scripts

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Vite dev server (:3000) + sync server (:8080) |
| `pnpm build`     | Production client build into `dist/`          |
| `pnpm start`     | Run the production server (app + sync)        |
| `pnpm test`      | Unit tests (vitest)                           |
| `pnpm typecheck` | TypeScript check                              |
| `pnpm lint`      | ESLint                                        |

## Keyboard shortcuts

| Key          | Action    |     | Key                       | Action                |
| ------------ | --------- | --- | ------------------------- | --------------------- |
| `V`          | Select    |     | `T`                       | Text                  |
| `H`          | Hand      |     | `E`                       | Eraser                |
| `P` / `D`    | Pen       |     | `Del`                     | Delete selection      |
| `R`          | Rectangle |     | `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo           |
| `O`          | Ellipse   |     | `Ctrl+D`                  | Duplicate             |
| `L`          | Line      |     | `Ctrl+A`                  | Select all            |
| `A`          | Arrow     |     | `Ctrl` + `+`/`-`/`0`      | Zoom in / out / reset |
| `Space`+drag | Pan       |     | Double-click              | Add / edit text & labels |
|              |           |     | `Enter`                   | Edit text of selected shape |
