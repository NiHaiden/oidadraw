# Synchronization and presence

[Documentation index](README.md) · [Core API](core.md) · [React API](react.md) · [Server](server.md)

`@kritzlboard/sync` connects a core document to a y-websocket server and exposes
peer presence and connection status. It has no React, routing, authentication,
localStorage, or application-environment dependency.

The implementation is in
[`packages/sync/src/connection.ts`](../packages/sync/src/connection.ts).
Its [public entry point](../packages/sync/src/index.ts) exports exactly:

```ts
export { BoardConnection }
export type { BoardConnectionOptions, ConnectionStatus }
```

The package currently builds compiled ESM and declarations into `dist/` for use
within the workspace. See [development](development.md) for package builds and
[the package README](../packages/sync/README.md) for a compact introduction.

## Responsibility and ownership

| Object | Owns | Does not own |
| --- | --- | --- |
| Core `BoardStore` | Yjs document, shapes, metadata, local undo history | WebSocket, account session, presence UI |
| `BoardConnection` | WebSocket provider, awareness state, transport/presence listeners | The supplied core store or its lifetime |
| React `Board` / `BoardProvider` | Editor interaction state and rendering | Destruction of the supplied store or connection |
| Application | Board ID, endpoint, user identity, resource lifecycle | Automatic server durability guarantees |
| Server | Shared rooms, broadcast, PostgreSQL snapshots | Client camera/tool/selection UI |

Use one connection for each local store. A different browser client gets its own
store with the same board ID and server URL. Yjs exchanges document changes between
those stores. Passing the same store to two editors shares a single local document
and is useful for demonstrations, but does not simulate independent remote peers.

Destroy the connection before destroying its store. Destroying a connection leaves
the store usable for offline editing or a replacement connection. If the store is
destroyed first, the connection listens for that event and detaches automatically.

## Basic usage

```ts
import { BoardStore } from "@kritzlboard/core"
import { BoardConnection } from "@kritzlboard/sync"

const store = new BoardStore("project-sketch")
const connection = new BoardConnection({
  store,
  url: "wss://boards.example.com/sync",
  user: { name: "Alex", color: "#2563eb" },
})

const unsubscribe = connection.subscribe(() => {
  console.log(connection.getStatus(), connection.getPeers())
})

connection.setCursor({ x: 40, y: 80 })
connection.setSelectionPresence(["shape-id"])
connection.setUser({ name: "Alex Smith", color: "#2563eb" })

// Pause networking while retaining the local document.
connection.disconnect()
store.setBoardName("Work completed offline")
connection.connect()

// When the host no longer needs this session:
unsubscribe()
connection.destroy()
store.destroy()
```

Constructing the connection normally begins networking immediately. Importing the
module alone does not create a socket. Supply `providerOptions: { connect: false }`
to initialize it offline.

## Public types

### ConnectionStatus

```ts
type ConnectionStatus = "connecting" | "connected" | "offline"
```

| Value | Meaning |
| --- | --- |
| `connecting` | A connection was requested or the provider is attempting to reconnect |
| `connected` | The provider reports an open WebSocket |
| `offline` | Initially disabled, explicitly disconnected, closed/failed socket, or destroyed connection |

These values describe transport state. They do not distinguish authentication
failure from network failure, and they do not report whether PostgreSQL has saved
the document.

The provider's separate `synced` property indicates completion of the initial
document handshake. It also does not confirm persistence.

### BoardConnectionOptions

```ts
interface BoardConnectionOptions {
  store: BoardStore
  url: string
  user: UserInfo
  providerOptions?: Omit<
    NonNullable<ConstructorParameters<typeof WebsocketProvider>[3]>,
    "awareness"
  >
}
```

| Option | Required | Description |
| --- | --- | --- |
| `store` | Yes | A live core store. A destroyed document causes the constructor to throw `Cannot connect a destroyed board store`. |
| `url` | Yes | WebSocket base URL. The provider appends `store.boardId` as the room name. |
| `user` | Yes | Initial display identity, installed before the first connection or cross-tab exchange. |
| `providerOptions` | No | Options forwarded to y-websocket, except externally supplied awareness. |

There is no default URL or inferred identity. The package does not read
`location`, `VITE_SYNC_URL`, cookies, account objects, or localStorage to fill in
these options.

### Related core types

These types come from `@kritzlboard/core`; the sync package uses them but does not
re-export them.

```ts
interface UserInfo {
  name: string
  color: string
}

interface PeerState {
  clientId: number
  user: UserInfo
  cursor: { x: number; y: number } | null
  selection: Array<string>
}
```

`cursor` is expressed in board/world coordinates, not viewport pixels.
`selection` contains shape IDs. A `clientId` identifies a Yjs client session; it
is not an account ID and is not stable user identity across reloads.

Display color is a string used for presence rendering, such as `"#2563eb"`.
These identity fields are client-supplied and are not an authentication mechanism.

## BoardConnection reference

All methods below are bound arrow functions and can be passed directly to
subscription hooks or the React presence interface.

| Member | Signature | Behavior |
| --- | --- | --- |
| Constructor | `new BoardConnection(options)` | Creates its own provider and awareness, installs identity/listeners, and connects unless disabled. |
| `provider` | `readonly WebsocketProvider` | Underlying y-websocket provider for advanced integration. The reference is read-only; the provider object remains mutable. |
| `subscribe` | `(listener: () => void) => unsubscribe` | Adds a listener for remote presence or connection-status changes. Does not invoke it immediately. |
| `getPeers` | `() => Array<PeerState>` | Returns the cached remote-peer snapshot, sorted numerically by client ID. |
| `getStatus` | `() => ConnectionStatus` | Returns the current cached transport status. |
| `connect` | `() => void` | Requests/resumes networking. Does nothing after destruction or if the socket is already connected. |
| `disconnect` | `() => void` | Withdraws presence, disconnects transport/cross-tab sync, clears remote peers, and sets status to offline while retaining local identity/state. |
| `setCursor` | `(cursor: PeerState["cursor"]) => void` | Publishes the local world-coordinate cursor or `null`. |
| `setSelectionPresence` | `(selection: Array<string>) => void` | Publishes the local selected shape IDs. |
| `setUser` | `(user: UserInfo) => void` | Replaces the local presence identity without recreating the document. |
| `destroy` | `() => void` | Withdraws presence, destroys provider and awareness, releases listeners/timers, clears peers/status, and leaves the store alive. Safe to call repeatedly. |

After destruction, setters and `connect()`/`disconnect()` do nothing;
`getStatus()` returns `"offline"` and `getPeers()` returns an empty snapshot.
Existing subscribers receive a final notification before the listener set is
cleared. A later subscription is not registered.

### Subscription and snapshot semantics

`subscribe()` is for connection/presence state. It does not replace the core
store's subscription for shapes, undo state, or board name.

`getPeers()` preserves its array identity until remote awareness changes.
Local-only cursor, selection, and user updates do not replace that snapshot or
notify peer consumers. Status changes can still invoke the same subscribers
without replacing the peer array.

The snapshot:

- Excludes this connection's local client ID.
- Excludes awareness states without a truthy `user` field.
- Uses `null` for a missing cursor and `[]` for a missing selection.
- Is ordered by ascending client ID.

Treat the returned array and nested values as read-only. The implementation does
not freeze or defensively clone them, and peer awareness fields are cast to the
expected types rather than fully validated. Likewise, pass fresh cursor,
selection, and user values to setters instead of mutating objects after
publication.

### Pause, reconnect, and offline work

`disconnect()` temporarily sets local awareness to `null` before detaching,
removes remembered remote awareness states, then restores the local state while
offline. This withdraws the peer from other clients while preserving its identity
and cursor/selection values for a later reconnect.

The core document remains editable. When a connection is re-established, Yjs
merges the local state with the server and other peers. The provider handles
reconnect attempts with exponential backoff; this package defaults its maximum
backoff to 5,000 ms.

Offline edits are held in the local document's memory. This package does not add
IndexedDB or any other browser persistence, so closing/reloading the page can lose
changes that never reached a persisted server snapshot.

Remote document updates use the provider as their transaction origin and stay
outside the core store's local undo history. Presence changes are not document
edits and are not undoable.

## Provider options

The options type follows the installed y-websocket constructor. The currently
declared dependency is `y-websocket ^2.1.0`; the following fields are defined by
its 2.1 API.

| Option | Type | Effective default | Purpose |
| --- | --- | --- | --- |
| `connect` | `boolean` | `true` at the wrapper level | Set false to start offline; call `connection.connect()` later. |
| `params` | `Record<string, string>` | `{}` | Query parameters appended to the WebSocket URL. |
| `protocols` | `Array<string>` | `[]` | WebSocket subprotocol names. |
| `WebSocketPolyfill` | WebSocket-compatible constructor | Global `WebSocket` | Supply a WebSocket implementation for runtimes that lack one. |
| `resyncInterval` | `number` | `-1` | A positive value periodically requests server state, in milliseconds. |
| `maxBackoffTime` | `number` | `5000` | Maximum reconnect backoff in milliseconds; overrides upstream's default. |
| `disableBc` | `boolean` | `false` | Disable the provider's same-origin cross-tab BroadcastChannel synchronization. |

`awareness` is excluded: the connection must own and clean up its awareness
instance. There is no option to inject an existing provider instance. Supplying a
custom transport requires a different adapter or a change to this package.

Internally the provider is always constructed with `connect: false`, even when
automatic connection was requested. The wrapper installs the initial
`{ user, cursor: null, selection: [] }` state and its listeners first, then calls
`connect()`. This prevents the first connection from advertising an incomplete
identity.

For provider defaults and advanced events, see the
[upstream y-websocket implementation](https://github.com/yjs/y-websocket/blob/v2.1.0/src/y-websocket.js).
Keep that dependency's API separate from the small Kritzlboard wrapper API.

### Advanced provider access

The provider exposes additional fields/events such as `synced`, `wsconnected`,
`awareness`, `params`, `sync`, and `connection-error`. These are upstream APIs,
not additional exports from `@kritzlboard/sync`.

```ts
const onSync = (synced: boolean) => {
  console.log("Initial document exchange complete:", synced)
}
const onError = (event: Event) => {
  console.error("WebSocket error:", event)
}

connection.provider.on("sync", onSync)
connection.provider.on("connection-error", onError)

// Remove listeners when their consumer unmounts.
connection.provider.off("sync", onSync)
connection.provider.off("connection-error", onError)
```

The wrapper subscription does not notify specifically for `provider.synced`
changes. Subscribe to the provider's `sync` event when that state drives UI.

Prefer the wrapper's lifecycle methods. Calling `provider.destroy()` directly
does not perform all the wrapper's cleanup, including destroying awareness.
Prefer `setUser()`, `setCursor()`, and `setSelectionPresence()` over replacing
the entire local awareness state.

## React integration

`BoardConnection` structurally satisfies `BoardPresence`, so pass it directly as
the board's optional `presence` prop. The React package does not import the sync
package or require a server.

Create owned resources in an effect so React Strict Mode can create, clean up, and
recreate them safely. This example keeps identity fixed for clarity:

```tsx
import { useEffect, useState, useSyncExternalStore } from "react"
import { BoardStore } from "@kritzlboard/core"
import { Board, usePeers } from "@kritzlboard/react"
import { BoardConnection } from "@kritzlboard/sync"
import "@kritzlboard/react/styles.css"

type Session = {
  url: string
  store: BoardStore
  connection: BoardConnection
}

function SessionStatus({ connection }: { connection: BoardConnection }) {
  const status = useSyncExternalStore(
    connection.subscribe,
    connection.getStatus,
    () => "offline" as const,
  )
  const peers = usePeers(connection)

  return (
    <p role="status">
      {status} · {peers.length} other editor(s)
    </p>
  )
}

export function CollaborativeBoard({
  boardId,
  url,
}: {
  boardId: string
  url: string
}) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const store = new BoardStore(boardId)
    const connection = new BoardConnection({
      store,
      url,
      user: { name: "Alex", color: "#2563eb" },
    })
    setSession({ url, store, connection })

    return () => {
      connection.destroy()
      store.destroy()
    }
  }, [boardId, url])

  // Avoid rendering a previous session while new props take effect.
  const active =
    session?.store.boardId === boardId &&
    session.url === url &&
    !session.store.doc.isDestroyed
      ? session
      : null

  if (!active) return <p>Opening board…</p>

  return (
    <section>
      <SessionStatus connection={active.connection} />
      <div style={{ height: 480 }}>
        <Board store={active.store} presence={active.connection} />
      </div>
    </section>
  )
}
```

For profile changes during the same editing session, call
`connection.setUser({ name, color })` from an effect depending on the connection,
name, and color. Recreating the store on every profile edit would discard that
store's local undo history and any local-only state.

The board requires a parent with a definite height. Import the React stylesheet
once in the host application. `Board` publishes cursor and selection through the
presence adapter; avoid a second competing cursor publisher for the same editor.

The [React hook reference](hooks.md) explains `usePeers`, local
`useBoardStore`, document subscriptions, and the application's connection-status
hook. A core store created by `useBoardStore()` remains local until a connection
is explicitly attached.

### Rendering on the server

Importing the package has no connection side effect. Constructing a connection
does create a provider, awareness resources, and timers, and normally begins
networking. `connect: false` prevents automatic connection but does not turn the
constructor into a resource-free SSR operation.

Construct browser connections after mount, or explicitly own and dispose them in
another runtime with a compatible WebSocket implementation. The effect-based
example renders its loading state on the server.

## Endpoint and network topology

For board ID `project-sketch` and base URL `wss://boards.example.com/sync`, the
provider connects to:

```text
wss://boards.example.com/sync/project-sketch
```

Use the base endpoint, not a URL that already contains the board ID. The bundled
server accepts only 1–64 ASCII letters, digits, underscores, and hyphens for room
names. The connection wrapper does not enforce that server-side rule itself.

The application adapter in [`src/board/store.ts`](../src/board/store.ts):

1. Extends the core `BoardStore`.
2. Selects `VITE_SYNC_URL` when set.
3. Otherwise derives `ws://<location.host>/sync` or
   `wss://<location.host>/sync` from the page protocol.
4. Creates a connection with the application's `getUser()` identity.
5. Destroys the connection before the core store in its overridden `destroy()`.
6. Exports `useConnectionStatus(store)`, implemented with
   `useSyncExternalStore` on the connection.

That adapter is application code, not the `@kritzlboard/core` package API. An
embedding application chooses its own URL and identity rather than importing the
adapter and its browser assumptions.

During normal development, Vite proxies `/sync` to the Node server with
`ws: true`. Production serves the app and socket endpoint from one origin.
With HTTPS, use `wss:` for the WebSocket endpoint.

The default provider can also synchronize matching documents across browser tabs
through BroadcastChannel. This channel is independent of the WebSocket status,
so an `offline` socket indicator alone does not prove that no same-origin tab is
exchanging document updates. Use `disconnect()` to detach both transports or
`disableBc: true` when cross-tab sync is inappropriate.

## Authentication and failure behavior

The package handles transport, not sign-in. With the bundled server,
`REQUIRE_AUTH` makes the WebSocket upgrade require a BetterAuth session from the
request headers. Same-origin browser connections use the browser's cookie
handling; the wrapper does not attach a bearer token or an account object.

`providerOptions.params` and `protocols` can support another server's handshake,
but the current Kritzlboard server does not interpret those options as a token
authentication scheme. Cross-origin embedding needs an explicit cookie/session
and server-origin design.

A rejected or unreachable connection becomes `offline` and may cycle through
reconnect attempts. The wrapper does not expose HTTP rejection bodies, an
`unauthorized` status, or a user-facing error object. Use the application's
account/config flow and provider events for diagnostics.

For custom transports, implement the small
[`BoardPresence` interface](react.md) for cursor/selection display and synchronize
the underlying core Yjs document separately. Presence alone does not copy shapes,
and sharing shapes alone does not supply peer cursors.

## Verification and extension points

[`connection.test.ts`](../packages/sync/src/connection.test.ts) covers identity
installation before connection, status transitions, cached/sorted remote peers,
cleanup while retaining the document, and cleanup when the store is destroyed
first. Its provider is mocked; those tests do not establish end-to-end server,
database, proxy, or authentication behavior.

From the repository root:

```sh
pnpm build:packages
pnpm --filter @kritzlboard/sync test
pnpm --filter @kritzlboard/sync typecheck
```

When changing transport behavior, check both its local lifecycle and a real
two-client session. Relevant cases include offline edits merging after reconnect,
departed peers disappearing, one client's undo preserving the other's edits, and
a rejected authenticated upgrade. These are validation steps, not claims that
they were executed while this documentation was written.

This reference describes the committed Kritzlboard implementation at `bdbea87`.

