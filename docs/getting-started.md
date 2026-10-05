# Getting started

[Documentation home](README.md) · [Application guide](application.md) · [Development guide](development.md)

## Requirements

Use Node.js 26 to match the repository's Docker image and pnpm 11.20.0, the version recorded in `package.json`. The root manifest declares Node.js `>=23.6`; the backend executes TypeScript directly with Node rather than compiling it to a separate server bundle.

For the default local setup, start a Docker engine. An existing PostgreSQL database can be used instead. The Compose configurations use PostgreSQL 17.

## Start the complete development application

From the repository root:

```sh
pnpm install
pnpm dev
```

Open **http://localhost:3000**.

The development runner:

1. Loads a root `.env` file if one exists; exported environment variables take priority.
2. Defaults `NODE_ENV` to `development` and the backend `PORT` to `3001`.
3. Starts the development PostgreSQL container and waits up to 60 seconds for readiness, unless `DATABASE_URL` is already set.
4. Starts the backend with Node's watch mode.
5. Builds all three packages, starts their watchers, and starts Vite on port 3000 with strict port selection.

Vite proxies `/api` and `/sync` to the backend. The browser uses one origin for cookies and collaboration. Database migrations run before the backend begins listening.

| Service | Default development address |
| --- | --- |
| Browser application | `http://localhost:3000` |
| Backend HTTP and WebSocket | `http://localhost:3001` |
| Development PostgreSQL | `127.0.0.1:5441` |
| Development database URL | `postgres://kritzlboard:kritzlboard@localhost:5441/kritzlboard` |

Press Ctrl+C to stop the frontend and backend. PostgreSQL stays running. Stop it while keeping its volume with:

```sh
pnpm db:down
```

Start just that database with `pnpm db:up`. The development Compose project is named `kritzlboard-dev`, so its volume is separate from the production Compose database.

## Use an existing database

Copy the optional configuration template:

```sh
cp .env.example .env
```

Set `DATABASE_URL` to the existing database, then run `pnpm dev`. A nonempty database URL skips automatic Docker startup.

For the database from the production Compose file, start that database first:

```sh
docker compose up -d db
```

Its host connection URL is:

```dotenv
DATABASE_URL=postgres://kritzlboard:kritzlboard@localhost:5440/kritzlboard
```

That uses the production Compose volume, not the isolated development database. Account and board data come from whichever database the URL selects.

Optional development settings:

```dotenv
PORT=3001
REQUIRE_AUTH=1
BETTER_AUTH_SECRET=replace-with-a-long-random-string
```

Changing `PORT` through `pnpm dev` updates both the backend listener and Vite proxy target. The frontend remains on port 3000. Configure trusted origins if you serve the frontend under an additional hostname; see the [server configuration reference](server.md).

## Run only the embedding examples

These examples use in-memory documents and need no database or auth server.

For the component playground:

```sh
pnpm build:packages
pnpm exec vite --config examples/component-demo/vite.config.ts
```

Open **http://127.0.0.1:3002**. It demonstrates complete boards, composed controls, custom controls, separate documents, SVG shape rendering, and local presence, with source views and a searchable API reference.

For the smaller existing example:

```sh
pnpm dev:web
```

Open **http://localhost:3000/examples/react-embedding/**. This command builds and watches the packages but does not start a backend. The embedding example works locally; the main product routes still expect their backend services.

Drawings in these examples are lost when their stores are destroyed or the page reloads. See [React integration](react.md) for using the same APIs in another host.

## Production with Docker

The checked-in Compose file starts the application and PostgreSQL:

```sh
docker compose up -d --build
```

Before using it outside local development, replace the sample `BETTER_AUTH_SECRET` in `docker-compose.yml` with your own random secret, for example one generated with `openssl rand -base64 32`. The Compose file sets this value directly; adding a different value to a root `.env` alone does not override that literal.

Open **http://localhost:8080**, or use the host's address.

| Resource | Purpose |
| --- | --- |
| Application port `8080` | Static client, auth API, board API, and WebSocket |
| PostgreSQL host port `5440` | Database access from the host |
| `kritzlboard-pgdata` volume | Persistent accounts, bookmarks, and board snapshots; actual volume name is Compose-project-prefixed |
| `kritzlboard-data` volume mounted at `/data` | Legacy file-based board import |

Ordinary `docker compose down` preserves named volumes. Removing those volumes removes their stored data. Use normal PostgreSQL backup/restore procedures for board and account backups; the legacy `/data` directory is not the current primary datastore.

## Production without Docker

Provide PostgreSQL and build the client and packages:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Set backend environment variables in your service manager or shell and run:

```sh
pnpm start
```

Alternatively, after configuring a root `.env` file, load it explicitly:

```sh
node --env-file=.env server/main.ts
```

Unlike `pnpm dev`, `pnpm start` does not load `.env` itself. Its default port is 8080, not the development runner's 3001. Ensure `DATABASE_URL` points to the intended database and `BETTER_AUTH_SECRET` is set.

The production process serves the root `dist/` directory, applies migrations, and accepts WebSocket connections at `/sync/<boardId>`. Run it from the repository root because the application uses relative paths for built assets and migrations.

## Reverse proxies and separate hosts

For the default topology, proxy HTTP and WebSocket traffic to the same backend and preserve the public host and protocol information. The browser chooses `wss:` when the application is loaded over HTTPS. Forward WebSocket upgrades for `/sync`, and keep `/api` on the same public origin as the frontend.

`VITE_SYNC_URL` overrides the WebSocket base URL at **client build time**. It does not move the auth API, configure cross-origin cookies, add an authorization mechanism, or take effect merely by changing a running server's environment. Supply a base URL such as `wss://boards.example/sync`; the sync provider appends the board ID.

Use one backend process for a deployment unless you add room coordination. The current implementation keeps live rooms in process memory; several Node processes sharing PostgreSQL do not automatically broadcast changes to one another.

See [Server reference](server.md) for all environment variables, auth behavior, room lifecycle, and persistence limitations.

## Verify a setup

1. Open the home page and create a board.
2. Draw a shape and edit its title.
3. Open the same board URL in another browser window and confirm edits and cursors appear in both.
4. Reload after the server has saved the document and confirm the drawing remains.
5. If authentication is required, use a signed-out/private window to check the login gate.

`GET /healthz` on the backend reports process health and the number of loaded rooms. It does not verify that PostgreSQL is reachable or that a particular edit has been saved.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Development runner cannot start PostgreSQL | Start the Docker engine, or provide a working `DATABASE_URL` |
| Frontend port is occupied | Stop the other process on 3000; strict port selection intentionally avoids silently changing the auth origin |
| App loads, but config requests or sync fail | Confirm the backend is running and Vite's proxy target matches `PORT` |
| Workspace package cannot be resolved | Run `pnpm install` and `pnpm build:packages`; imports resolve to package `dist/` exports |
| Package source changes do not appear | Run the package watchers or rebuild; the main development command already watches all packages |
| Embedded board has no visible canvas | Give its container a definite height and import `@kritzlboard/react/styles.css` |
| Board appears empty under another setup | Check the board URL, selected database, Compose project, and volume; dev and production use separate databases by default |
| Login works locally but fails behind a proxy | Check origin/protocol forwarding and `TRUSTED_ORIGINS` against the public URL |
| Drawing remains offline | Check WebSocket upgrade forwarding, URL, and authentication; connection status is not a database-save receipt |
| Server changes appear but frontend changes do not in production | Rebuild `dist/` or rebuild the container image |

