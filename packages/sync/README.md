# @kritzlboard/sync

Optional WebSocket synchronization, connection status, and peer presence for
`@kritzlboard/core`. This package has no React, router, authentication, storage,
or application configuration dependency. It uses the existing y-websocket
protocol and works with the current Kritzlboard server.

## Connect a document

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

connection.setCursor({ x: 10, y: 20 })
connection.setSelectionPresence(["shape-id"])
connection.setUser({ name: "Alex Smith", color: "#2563eb" })

unsubscribe()
connection.destroy()
// The document is still available for local editing, saving, or a new connection.
store.destroy()
```

The server URL is a base URL: the provider appends `store.boardId` as the room
name. The host chooses the endpoint and identity. No URL or user is inferred
from environment variables, location, accounts, or localStorage.

Each connection owns its provider and awareness state. `destroy()` withdraws
presence, disconnects the provider, releases listeners and timers, and is
idempotent. It never destroys the supplied store. Destroy the connection before
destroying the store; it also detaches if the store is destroyed first. Use one
connection per local store. A peer on another client uses its own store with the
same board ID and server URL.

`disconnect()` pauses networking and withdraws presence, preserving the local
document and identity. `connect()` resumes networking; Yjs merges edits made
while offline. `getStatus()` returns `connecting`, `connected`, or `offline`.
Connected describes the socket; `connection.provider.synced` indicates completion
of the initial document handshake.

Subscriptions notify on peer or connection changes. `getPeers()` returns a cached
snapshot sorted by client ID, excluding this connection's local identity. Treat
snapshots as read-only. Changes to shapes remain available through the core
store's separate subscription. Remote edits stay outside local undo history.

## Use with React

`BoardConnection` implements the React package's optional presence interface.
Pass it as `presence` while passing the core store as `store`:

```tsx
import { useEffect, useState } from "react"
import { BoardStore } from "@kritzlboard/core"
import { BoardConnection } from "@kritzlboard/sync"
import { Board } from "@kritzlboard/react"
import "@kritzlboard/react/styles.css"

export function CollaborativeBoard({
  boardId,
  url,
  name,
  color,
}: {
  boardId: string
  url: string
  name: string
  color: string
}) {
  const [session, setSession] = useState<{
    store: BoardStore
    connection: BoardConnection
  } | null>(null)

  useEffect(() => {
    const store = new BoardStore(boardId)
    const connection = new BoardConnection({
      store,
      url,
      user: { name, color },
    })
    setSession({ store, connection })
    return () => {
      connection.destroy()
      store.destroy()
    }
  }, [boardId, url, name, color])

  return (
    <div style={{ height: 480 }}>
      {session && <Board store={session.store} presence={session.connection} />}
    </div>
  )
}
```

The effect creates a session after mount and cleans it up in React Strict Mode.
For identity changes within an existing session, call `connection.setUser` to
retain its document and local undo history. `usePeers(connection)` from
`@kritzlboard/react` can drive custom peer controls; use React's
`useSyncExternalStore(connection.subscribe, connection.getStatus,
connection.getStatus)` for connection status.

## Provider options

`providerOptions` forwards y-websocket options except externally owned awareness.
For example, `{ connect: false }` starts offline until `connect()` is called;
`params` and `protocols` configure the WebSocket handshake, `disableBc` disables
cross-tab synchronization, and `WebSocketPolyfill` supports runtimes without a
native WebSocket implementation. Reconnect backoff defaults to a maximum of five
seconds. `provider` exposes the underlying provider for advanced integrations.

Importing the package performs no network setup. Create connections on the client
or in a runtime with a WebSocket implementation. Authentication and document
persistence remain the host/server's responsibility.

## Development

```sh
pnpm build:packages
pnpm --filter @kritzlboard/sync test
pnpm --filter @kritzlboard/sync typecheck
```

The package exports compiled ESM and TypeScript declarations from `dist/` and is
currently a local workspace package, not published to a registry. Root build,
test, and typecheck commands build it first. `pnpm dev:web` watches its output
alongside the other packages and reloads the application after rebuilds.
