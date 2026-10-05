# Server, authentication, and persistence

[Documentation index](README.md) · [Architecture](architecture.md) · [Synchronization](sync.md)

The server in [`server/main.ts`](../server/main.ts) is one Node process that serves
the built application, handles account sessions and recent boards, and synchronizes
Yjs documents over WebSockets. PostgreSQL stores account data and board snapshots.

The server is currently an application entry point with a private
[`server/package.json`](../server/package.json). It is not yet an importable
`@kritzlboard/server` workspace package or a configurable server factory.

## Source map

| File | Responsibility |
| --- | --- |
| [`server/main.ts`](../server/main.ts) | HTTP routing, WebSocket upgrades, room lifecycle, persistence, startup and shutdown |
| [`server/auth.ts`](../server/auth.ts) | BetterAuth configuration and trusted origins |
| [`server/db.ts`](../server/db.ts) | PostgreSQL connection pool and Drizzle database |
| [`server/schema.ts`](../server/schema.ts) | Board snapshots and users' recent-board entries |
| [`server/auth-schema.ts`](../server/auth-schema.ts) | BetterAuth tables and relations |
| [`server/drizzle/0000_init.sql`](../server/drizzle/0000_init.sql) | Initial account and board tables |
| [`server/drizzle/0001_user-boards.sql`](../server/drizzle/0001_user-boards.sql) | Recent-board table |
| [`drizzle.config.ts`](../drizzle.config.ts) | Migration generation configuration |
| [`src/lib/auth-client.ts`](../src/lib/auth-client.ts) | Same-origin browser auth client and public server configuration |
| [`src/board/store.ts`](../src/board/store.ts) | Application-owned document and sync connection |

## Internal code entry points

These are implementation details in `server/main.ts`, not an exported server SDK.

| Entry point | Role |
| --- | --- |
| `Room` constructor | Creates a document and awareness instance; installs update broadcasts and save scheduling. |
| `Room.load()` | Loads a PostgreSQL snapshot or imports a legacy file. |
| `Room.broadcast(message)` | Sends binary messages to open sockets; closes connections when sending fails. |
| `Room.scheduleSave()` | Marks the room dirty and starts one pending save timer. |
| `Room.save()` | Encodes and queues the room's next full snapshot. |
| `Room.closeConn(conn)` | Removes controlled awareness IDs and initiates final-disconnect save/eviction. |
| `getRoom(name)` | Reuses an open room or shares one in-progress load. |
| `handleMessage(room, conn, message)` | Dispatches Yjs synchronization and awareness messages. |
| `setupConnection(conn, room, earlyMessages)` | Installs socket handlers/heartbeat and performs the initial handshake. |
| `handleSyncUpgrade(...)` | Accepts the WebSocket and buffers messages until room loading finishes. |
| `handleBoardsApi(req, res, pathname)` | Enforces session/origin checks and handles recent-board operations. |
| `boardName(id, docBytes)` | Reads a name from an open room or a temporary decoded snapshot. |
| `sendJson(res, status, body)` | Serializes API responses with a JSON content type. |
| `serveFile(res, filePath)` | Streams built files with MIME and cache headers. |
| `onListening(host)` | Logs effective endpoints and client-build availability. |
| `shutdown()` | Saves registered rooms, closes the database pool, and exits once. |

`rooms` holds active in-memory rooms. `roomLoads` prevents duplicate concurrent
loads. Within each room, `conns` maps sockets to the awareness client IDs they
control; `dirty`, `saveTimer`, and `saving` track persistence scheduling.

## Running the server

For the complete development application, use `pnpm dev` from the repository root.
That command loads an optional `.env`, starts the development database unless
`DATABASE_URL` is supplied, and runs Vite on port 3000 with the backend on port 3001.

To run the server independently with the root dependencies installed:

```sh
pnpm build
pnpm start
```

The default backend port for this direct command is 8080. Unlike `pnpm dev`,
`pnpm start` does not load `.env` itself. Export environment variables or use:

```sh
node --env-file=.env server/main.ts
```

Node executes the TypeScript entry point using built-in type stripping. The root
manifest requires Node >=23.6; the Docker image uses Node 26. Database migrations
must complete before the HTTP server begins listening. An unavailable database or
failed migration therefore prevents normal startup.

The backend can run without a client build: API and WebSocket routes still work,
while requests for application files return 503 when `dist/` is absent.

## Configuration

Values are read when server modules load. Restart the process after changing them.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8080`; development launcher sets `3001` | HTTP and WebSocket listening port; converted with `Number()` |
| `HOST` | `::` | Dual-stack listening address; falls back to `0.0.0.0` if IPv6 is unavailable |
| `DATABASE_URL` | `postgres://kritzlboard:kritzlboard@localhost:5432/kritzlboard` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Unset in application code | BetterAuth signing/encryption secret; production logs a warning when it is absent |
| `BETTER_AUTH_URL` | Unset | Explicit public authentication base URL; otherwise BetterAuth determines it from the request |
| `REQUIRE_AUTH` | Disabled | Enables the board WebSocket sign-in gate for `1`, `true`, or `yes`, case-insensitively |
| `TRUSTED_ORIGINS` | Additional origins empty | Comma-separated origins appended to `http://localhost:3000`; entries are not whitespace-trimmed |
| `DATA_DIR` | `./data`, resolved from the working directory | Location of legacy `<boardId>.yjs` files imported on first open |
| `NODE_ENV` | Unset by the entry point | Used for the missing-secret production warning; Docker sets `production` |
| `VITE_SYNC_URL` | Current browser origin plus `/sync` | Client build setting, not a server setting; see [sync topology](sync.md#endpoint-and-network-topology) |

The development database uses host port 5441 in
[`docker-compose.dev.yml`](../docker-compose.dev.yml). The full-stack
[`docker-compose.yml`](../docker-compose.yml) exposes PostgreSQL on host port
5440 and the application on 8080. Inside that Compose network the backend connects
to `db:5432`. These are separate database volumes.

## HTTP API

All paths below are relative to the application's origin. The application does not
define a JSON board-content CRUD API: documents travel through the Yjs WebSocket
protocol.

| Method | Path | Authentication | Success response |
| --- | --- | --- | --- |
| GET, conventionally | `/api/config` | None | `200 {"requireAuth": false}` or `true` |
| GET, conventionally | `/healthz` | None | `200 {"ok": true, "rooms": 0}` |
| Delegated | `/api/auth/*` | BetterAuth endpoint-dependent | Handled by BetterAuth's Node handler |
| GET | `/api/boards` | Session cookie required | Up to 50 recent-board entries |
| POST | `/api/boards/:boardId/touch` | Session cookie required | `200 {"ok": true}` |
| DELETE | `/api/boards/:boardId` | Session cookie required | `200 {"ok": true}` |
| GET or HEAD | Other paths | None | Built file or SPA fallback |

The configuration and health handlers currently do not restrict the request
method. Requests reach these handlers before the static server's GET/HEAD check.

### Public configuration

`GET /api/config` exposes only the `requireAuth` boolean. The browser uses it to
decide whether to show a sign-in gate. This response is not the enforcement point:
the WebSocket upgrade checks the session independently when authentication is
required.

The client's `getServerConfig()` returns `{ requireAuth: false }` if fetching
configuration fails. This fallback affects the UI; it does not bypass server-side
WebSocket authentication.

### Health

`GET /healthz` reports the number of rooms in memory. It does not query PostgreSQL,
confirm that recent saves succeeded, count connections, or inspect pending room
loads. A successful health response shows that the HTTP process is responding.

### Authentication

[`server/auth.ts`](../server/auth.ts) configures BetterAuth with:

- Email/password registration and sign-in enabled.
- The Drizzle PostgreSQL adapter and the generated authentication schema.
- Session handling through BetterAuth's request-header and cookie machinery.
- The configured base URL, secret, and trusted-origin list.

The browser's `signIn`, `signUp`, `signOut`, and `useSession` exports come from
BetterAuth. The server forwards `/api/auth/*` requests rather than implementing a
separate account protocol. Consult the installed BetterAuth version when extending
that API; application code does not add OAuth providers, an invitation system,
board roles, or ownership checks.

### Recent boards

`GET /api/boards` returns:

```json
[
  {
    "id": "project-sketch",
    "name": "Project sketch",
    "at": 1789900000000
  }
]
```

- `id` is a board ID.
- `name` comes from the document's `meta.name`. An open room is preferred over
  its persisted snapshot, so current in-memory renames appear immediately.
- `at` is the user's last-opened timestamp in Unix milliseconds.
- Results are ordered by most recently opened, limited to 50, with no pagination.

`POST /api/boards/:boardId/touch` inserts or updates the current user's
`user_board` entry. No request body is required. It does not need an existing
`board` row: a new document may not have reached its first save.

`DELETE /api/boards/:boardId` removes the current user's recent-board entry.
**It does not delete the document, disconnect editors, or revoke anyone's access.**
The endpoint returns success even if that entry was already absent.

IDs accepted by the board API and WebSocket server are 1–64 ASCII letters, digits,
underscores, or hyphens: `^[A-Za-z0-9_-]{1,64}$`.

### Recent-board errors and origin handling

| Condition | Response |
| --- | --- |
| Mutation with an `Origin` whose host differs from `Host` and which is absent from `TRUSTED_ORIGINS` | `403 {"error":"cross-origin request rejected"}` |
| Missing/invalid session, or a session lookup failure | `401 {"error":"not signed in"}` |
| Unsupported route, invalid board ID, or unsupported method after the preceding checks | `404 {"error":"not found"}` |
| Unhandled database/handler error | `500 {"error":"internal error"}` |

The mutation origin check runs before session lookup. It is skipped for GET and
for requests without an `Origin` header. The same-host comparison uses the URL
host, including its port. This is an origin check for these cookie-authenticated
mutations, not a general CORS implementation.

## Board access model

With `REQUIRE_AUTH` disabled, any client that knows a valid board ID can connect.
With it enabled, any signed-in user who knows that ID can connect. There is
currently no per-board owner, membership table, read-only role, or board-specific
authorization check.

The `user_board` table is a list of recent boards, not an access-control list.
Display names and colors in awareness messages are client-supplied presence data;
they are not verified against the session's account.

The WebSocket upgrade currently checks the path and, optionally, the session.
It does not apply the recent-board endpoint's explicit `Origin` comparison.
Adding cross-origin deployments or board permissions requires an explicit server
design; setting `TRUSTED_ORIGINS` alone does not implement either feature.

## WebSocket protocol and room lifecycle

Connect to `ws://host:port/sync/<boardId>`, or `wss://` behind HTTPS. The sync
package takes the base URL ending in `/sync` and appends the board ID.

1. The upgrade handler matches `/sync/<boardId>` and validates the decoded ID.
   Invalid upgrade paths or IDs receive HTTP 400.
2. When `REQUIRE_AUTH` is enabled, a failed session lookup receives HTTP 401.
3. The WebSocket is accepted, and messages are temporarily buffered while the
   document loads.
4. `getRoom()` reuses an open room or deduplicates concurrent loads for the same ID
   through `roomLoads`.
5. Connection setup attaches message/close/pong listeners, replays buffered
   messages, and sends the initial sync step and any current awareness states.
6. Document updates are broadcast to connected sockets and scheduled for storage.
   Awareness updates are broadcast without being persisted.
7. Closing a connection removes the awareness client IDs that it controls. The
   last connection triggers a save and eventual room eviction.

The server implements y-websocket message type 0 for Yjs synchronization and type
1 for awareness. Malformed messages are caught and logged; the handler does not
return a structured application error.

Each connection is pinged every 30 seconds. If it has not answered the preceding
ping with a pong by the next check, it is closed. This detects abandoned
connections and allows their presence to be removed.

## PostgreSQL data model

| Table | Key and important columns | Purpose |
| --- | --- | --- |
| `board` | `id` primary key; `doc bytea`; `created_at`, `updated_at` | One full Yjs binary state update per board |
| `user_board` | Composite key `(user_id, board_id)`; `last_opened_at` | Per-user recent boards |
| `user` | `id`; unique `email`; name, verification flag, optional image, timestamps | Account profile |
| `session` | `id`; unique token, expiry, user ID, IP/user-agent metadata | BetterAuth sessions |
| `account` | `id`; account/provider IDs, user ID, credential/token fields | BetterAuth account credentials |
| `verification` | `id`; identifier, value, expiry, timestamps | BetterAuth verification records |

`user_board.user_id`, `session.user_id`, and `account.user_id` reference
`user.id` with cascading deletion. `user_board.board_id` deliberately has no
foreign key to `board.id`, because a recent-board entry can precede the first
document save. Deleting an account does not delete board documents.

A board snapshot contains shared document data such as shapes and board metadata.
Camera position, current tool, local selection UI, peer cursors, and presence are
not stored as server-side board fields. See [core data model](core.md).

### Loading and legacy import

On first opening a room, the server queries `board.doc`. If a row exists, it
applies that Yjs update to a new document. Otherwise it looks for
`DATA_DIR/<boardId>.yjs`, applies it if present, and writes the imported document
to PostgreSQL. The legacy file is not deleted.

Loading is lazy: startup does not import every legacy file. PostgreSQL is the
current persistence store; the legacy directory is not a continuously updated
backup.

### Saving and eviction

The first document update starts a **1,200 ms** save timer. Further updates while
that timer is pending share the same scheduled save; they do not reset its
deadline. The save encodes the full document using `Y.encodeStateAsUpdate()` and
upserts `board.doc`, updating `updated_at` on existing rows.

Each room chains writes through a promise, so its snapshots reach PostgreSQL in
the order they were queued. This is snapshot persistence, not an append-only
event log, per-edit history, or a client-visible durable-save acknowledgement.

When the last connection leaves, the pending timer is cleared and a save is
requested immediately. Once that save chain completes, the room is removed and
its awareness/document resources are destroyed if it is still empty and remains
the registered room. Reconnecting before completion keeps the room alive.

### Failure and durability limits

Load errors are logged and swallowed; the room can still be opened with empty or
partially loaded state. Save errors are also logged and mark the room dirty again.
They do not independently schedule a retry: another edit, disconnect, or shutdown
may trigger one.

The final-disconnect eviction currently occurs even after a save error, because
`save()` catches its own errors. In-memory edits can consequently be lost if the
database is unavailable at that point. A WebSocket status of `connected` or
`provider.synced === true` is not evidence that a PostgreSQL write succeeded.

For deployments that require stronger guarantees, durable-save acknowledgement,
load failure handling, retry policy, and eviction on save failure are concrete
extension points.

## Static application serving

The server resolves files inside the root `dist/` directory. Existing files are
streamed with MIME types selected from their extensions; missing files and
directories fall back to `dist/index.html` so client-side board routes work on
reload.

Files under an `assets/` directory receive
`Cache-Control: public, max-age=31536000, immutable`. Other files receive
`Cache-Control: no-cache`. Unknown MIME extensions use
`application/octet-stream`.

Non-GET/HEAD requests not already handled by an API route return 405. An unknown
`/api/...` path outside the auth and boards prefixes can reach the SPA fallback;
there is no global JSON API 404 handler.

## Deployment and operations

[`Dockerfile`](../Dockerfile) builds the workspace packages and Vite application
in a Node 26 stage, then installs the server runtime dependencies and copies the
server source, migrations, and `dist/` into the runtime image.

For the supplied full-stack setup:

```sh
docker compose up --build -d
docker compose logs -f kritzlboard
```

Configure the deployment's database and authentication secret before using it.
The Compose file includes development credentials and a placeholder secret.
PostgreSQL's persistent volume contains both documents and account data; include
both when planning backup and restoration.

A reverse proxy must forward ordinary HTTP traffic and WebSocket upgrade traffic
for `/sync/*`. Preserve the browser-facing host/protocol configuration used by
the account flow. Development uses Vite's `/api` and `/sync` proxy to keep both
on the same browser origin.

Run one server process for the current room implementation. The in-memory room
maps and broadcasts are process-local: a shared PostgreSQL database does not
coordinate live edits between multiple server instances. Multiple writers for
one board can save competing snapshots. Horizontal scaling requires shared room
coordination or a routing design that keeps every board on one authoritative
process.

On SIGINT or SIGTERM, the server starts shutdown once, awaits saves for the rooms
currently registered, closes the database pool, and exits. The current code does
not first drain HTTP/WebSocket traffic, await all pending room loads, or enforce a
shutdown deadline. Allow time for normal shutdown and do not treat it as a
guaranteed flush after an earlier persistence failure.

## Database changes and extension points

To add a persisted field, update the Drizzle schema and generate a migration:

```sh
pnpm exec drizzle-kit generate
```

Review the generated SQL and metadata under `server/drizzle/`. Startup applies
pending migrations; there is no separate root `db:migrate` script.

Common changes belong at these boundaries:

- Board-specific access rules: WebSocket upgrade authorization plus a matching
  access model; recent-board bookmarks are insufficient.
- New HTTP APIs: route dispatch in `server/main.ts`, with explicit method,
  authentication, validation, and error contracts.
- Alternate persistence: `Room.load()` and `Room.save()`, preserving Yjs binary
  updates and write ordering.
- Importable server package: extract construction and lifecycle from top-level
  startup before exposing a reusable API.
- Durable-save indicators: add an acknowledged persistence protocol; existing
  connection and sync status cannot provide one.

This reference is based on the committed implementation at `bdbea87`; its
operational limits describe the code, not a completed deployment test.

