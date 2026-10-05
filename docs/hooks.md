# React hooks and application state helpers

This reference covers hooks implemented or re-exported by the repository, their
resource ownership, and the application helpers used alongside them. The
[React integration guide](react.md) shows composition recipes; the
[component reference](../packages/react/docs/components.md) contains component
props and the complete public editor action list.

## Inventory and imports

| Hook | Import/source | Context required |
| --- | --- | --- |
| `useBoardStore` | `@kritzlboard/react` | None |
| `useBoardEditor` | `@kritzlboard/react` | `Board` or `BoardProvider` |
| `useShapes` | `@kritzlboard/react` | None; supply a store |
| `useBoardName` | `@kritzlboard/react` | None; supply a store |
| `useCanUndoRedo` | `@kritzlboard/react` | None; supply a store |
| `usePeers` | `@kritzlboard/react` | None; optionally supply presence |
| `useConnectionStatus` | [src/board/store.ts](../src/board/store.ts) | None; supply an application store |
| `useSession` | [src/lib/auth-client.ts](../src/lib/auth-client.ts), re-exported from Better Auth | Shared auth client; no explicit application auth provider |
| `useBoardController` | [packages/react/src/useBoardController.ts](../packages/react/src/useBoardController.ts) | Internal provider implementation only |
| `useBoardContext` | [packages/react/src/context.tsx](../packages/react/src/context.tsx) | Internal; `BoardProvider` |

The last two hooks are not exported by the package entry point. Do not deep-import
them into another application. `src/board/store.ts` also re-exports
`useBoardName` and `usePeers`; these are the same package hooks, not alternative
implementations.

[src/lib/user.ts](../src/lib/user.ts) contains **no React hooks**. Its functions
read and write browser identity and recent-board metadata. They are documented
below because the application uses them with React state and effects.

## Ownership rules

| Operation | Creates resources? | Who disposes them? |
| --- | --- | --- |
| `useBoardStore(id)` | A local core document/store after mount | The hook, on ID change or unmount |
| Store-observation hooks | React subscriptions only | React removes the subscriptions |
| `useBoardEditor()` | Nothing; reads context | The provider owns editor state |
| `BoardProvider` | Editor state and listeners | Provider cleanup; supplied store and adapter remain alive |
| `BoardConnection` construction | Network provider and awareness | The host creating the connection |
| Application `BoardStore` construction | Core store and its connection | The application's owner, usually the board route |
| `useConnectionStatus` | React subscription only | React removes the subscription |
| `useSession` | Uses Better Auth's shared client query state | Better Auth owns that query/subscription lifecycle |

A board ID does not imply durable storage. Local `useBoardStore` documents
disappear when their owner is disposed. Browser recent-board entries and drawing
preferences are not saved drawing contents.

## `useBoardStore(boardId = "local")`

```ts
useBoardStore(boardId?: string): BoardStore | null
```

The return type is the core `BoardStore`, not the application subclass from
`src/board/store.ts`. It has no implicit network connection, account lookup,
localStorage access, or server URL configuration.

The hook runs an effect depending on `boardId`. That effect creates a store,
publishes it through React state, and returns a cleanup that destroys the exact
store it created. The return value is `null` whenever the state does not yet
contain a store matching the requested ID.

```tsx
import { Board, useBoardStore } from "@kritzlboard/react"

export function RoutedSketch({ boardId }: { boardId: string }) {
  const store = useBoardStore(boardId)

  return (
    <div style={{ height: 480 }}>
      {store && <Board store={store} aria-label="Drawing" />}
    </div>
  )
}
```

Lifecycle behavior:

- Initial client render: `null`; the effect then creates the store.
- Server render: `null`; effects do not create a server-side document.
- ID change: the old store is cleaned up, and a new store is created.
- Unmount: the hook destroys its store.
- Strict Mode: effect setup and cleanup may run again; each effect owns its own
  store and cleans up that instance.

Two calls with the same ID return independently created stores. Share one returned
store explicitly when two views must display one local document. Do not manually
destroy the returned store or use it after its owning component unmounts.

## `useBoardEditor()`

```ts
useBoardEditor(): BoardEditor
```

Reads the surrounding provider and returns its public editor state and commands.
It must run in a descendant of `Board` or `BoardProvider`. Without that context
it throws `"Board components must be inside a BoardProvider"`.

The editor exposes `store`, `camera`, `tool`, `selection`, `selectedShapes`,
`style`, and commands for tool/selection changes, styles, deletion, duplication,
select-all, and zoom. See the component reference for each member and type.

```tsx
import { useBoardEditor } from "@kritzlboard/react"

export function SelectionActions() {
  const editor = useBoardEditor()

  return (
    <div role="toolbar" aria-label="Selection actions">
      <button type="button" onClick={editor.selectAll}>
        Select all
      </button>
      <button
        type="button"
        disabled={editor.selection.size === 0}
        onClick={editor.duplicateSelection}
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={editor.selection.size === 0}
        onClick={editor.deleteSelection}
      >
        Delete
      </button>
    </div>
  )
}
```

The editor value and all of its command functions are not promised to retain
object identity between renders. Use commands as event handlers. Do not attach a
resource-creation effect to the entire `editor` object and expect it to run only
once. Select stable resource dependencies such as the supplied `store` instead.

Selection is a `ReadonlySet<string>`; replace it with a new set through
`setSelection`, rather than mutating the existing set. Changing tool away from
`select` clears selection. Document changes and undo/redo belong to the store;
camera and active tool belong to the provider session.

## `useShapes(store)`

```ts
useShapes(store: BoardStore): Array<Shape>
```

Subscribes with `useSyncExternalStore(store.subscribe, store.getShapes,
store.getShapes)`. The third function supplies the server snapshot. No provider
is required.

The core store caches the array until it rebuilds the shape snapshot after a
document change. Shapes are in paint order; connector geometry is derived by the
core store. Treat the returned array and shapes as read-only. Use `putShape`,
`putShapes`, or `deleteShapes` to change the document.

Use this hook when rendered output depends on document contents. Calling
`store.getShapes()` during a render without a subscription does not make that
component reactive.

## `useBoardName(store)`

```ts
useBoardName(store: BoardStore): string
```

Subscribes to the store and uses `store.getBoardName` for both client and server
snapshots. Returns an empty string when no name is stored. It needs no provider.

Update the value with `store.setBoardName(name)`. Name metadata is shared with
the document, but it is outside the shape undo manager's tracked map. Renaming
does not create a shape undo step.

## `useCanUndoRedo(store)`

```ts
useCanUndoRedo(
  store: BoardStore
): { canUndo: boolean; canRedo: boolean }
```

Uses two external-store subscriptions with the store's `getCanUndo` and
`getCanRedo` getters, including matching server snapshots. It does not require
editor context and does not perform an undo or redo itself.

Here is a host-side observer combining the three document hooks:

```tsx
import type { BoardStore } from "@kritzlboard/core"
import {
  useBoardName,
  useCanUndoRedo,
  useShapes,
} from "@kritzlboard/react"

export function DocumentStatus({ store }: { store: BoardStore }) {
  const name = useBoardName(store)
  const shapes = useShapes(store)
  const { canUndo, canRedo } = useCanUndoRedo(store)

  return (
    <section aria-label="Document status">
      <p>{name || "Untitled board"} · {shapes.length} shapes</p>
      <button
        type="button"
        disabled={!canUndo}
        onClick={() => store.undo()}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={() => store.redo()}
      >
        Redo
      </button>
    </section>
  )
}
```

All three hooks unsubscribe when their input changes or component unmounts. They
do not destroy their input store.

## `usePeers(presence?)`

```ts
usePeers(presence?: BoardPresence): Array<PeerState>
```

Observes an optional presence adapter. It uses the adapter's `subscribe` and
`getPeers` methods when available. Without an adapter it uses stable no-op
subscription functions and a cached empty array. The server snapshot is always
that empty array. It does not require editor context.

`PeerState` contains `clientId`, `user: { name, color }`, `cursor` in world
coordinates or `null`, and selected shape IDs. A sync `BoardConnection` supplies
peer snapshots excluding its own identity.

```tsx
import { usePeers } from "@kritzlboard/react"
import type { BoardPresence } from "@kritzlboard/react"

export function Participants({ presence }: { presence?: BoardPresence }) {
  const peers = usePeers(presence)

  return (
    <ul aria-label="Other participants">
      {peers.map((peer) => (
        <li key={peer.clientId}>{peer.user.name}</li>
      ))}
    </ul>
  )
}
```

Adapter rules:

- `getPeers()` must return the same array while its contents are unchanged.
  Returning a freshly allocated array on every call violates the external-store
  snapshot contract.
- Replace the cached snapshot before notifying subscribers of a change.
- `subscribe(listener)` returns an unsubscribe function.
- Keep methods stable and bound to their receiver if they depend on `this`.
- Keep the adapter object stable while its session remains active.
- Treat snapshots as read-only.

The hook subscribes only. It neither opens a connection nor publishes cursor or
selection state. The editor controller performs publication when the adapter is
passed to a board's `presence` prop. Document synchronization is a separate task.

## Application `useConnectionStatus(store)`

Defined in [src/board/store.ts](../src/board/store.ts):

```ts
useConnectionStatus(
  store: ApplicationBoardStore
): "connecting" | "connected" | "offline"
```

Here `ApplicationBoardStore` means the `BoardStore` exported from that file, not
a separately named exported type. The hook reads `store.connection` and
subscribes to its `subscribe`/`getStatus` methods with `getStatus` also supplying
the server snapshot.

```tsx
import {
  useConnectionStatus,
  type BoardStore,
} from "@/board/store"

export function NetworkStatus({ store }: { store: BoardStore }) {
  const status = useConnectionStatus(store)
  return <output aria-live="polite">{status}</output>
}
```

This hook belongs to the application. A package consumer owning a
`BoardConnection` can use React's `useSyncExternalStore` directly:

```tsx
import { useSyncExternalStore } from "react"
import type { BoardConnection } from "@kritzlboard/sync"

export function ConnectionStatus({
  connection,
}: {
  connection: BoardConnection
}) {
  const status = useSyncExternalStore(
    connection.subscribe,
    connection.getStatus,
    connection.getStatus
  )
  return <output>{status}</output>
}
```

Status describes the socket lifecycle. `"connected"` does not itself mean the
initial document handshake is complete; advanced integrations can inspect the
underlying provider's `synced` state.

Observing status does not own or destroy the connection. Although the hook has a
server-snapshot function, the application store constructor itself is browser
integration code: it derives a URL from browser location or `VITE_SYNC_URL`,
gets the local identity, and constructs a connection. Do not instantiate that
application store while server-rendering an embed.

## Application `useSession()`

[src/lib/auth-client.ts](../src/lib/auth-client.ts) creates a shared client with
`createAuthClient()` from `better-auth/react` and re-exports its `useSession`.
This is a dependency-provided hook, not a custom session implementation. The
application calls it without arguments and does not install a separate auth
provider; its shared auth client owns the query state.

The repository uses these returned fields:

| Field | Usage |
| --- | --- |
| `data` | The authenticated session, or no session; its `user.name` and `user.email` drive UI and presence identity |
| `isPending` | Prevents displaying or persisting signed-out state before the initial session query resolves |

Other query fields and refresh options are inherited from the installed Better
Auth client's types. Use `ReturnType<typeof useSession>` when forwarding its
result rather than defining a second session-query type.

```tsx
import { useSession } from "@/lib/auth-client"

export function AccountLabel() {
  const { data: session, isPending } = useSession()

  if (isPending) return <span>Checking account…</span>
  return <span>{session ? session.user.name : "Guest"}</span>
}
```

The current application is a client-rendered SPA. Its auth client uses same-origin
API routes, served by the application server or proxied by Vite during development.
It does not provide custom server-rendered session hydration. A host embedding
only the board can use any authentication scheme and does not need this hook.

Related exports `signIn`, `signUp`, and `signOut` are actions, not hooks.
`authClient.getSession()` is the imperative API used by the board route's
`beforeLoad` guard; hooks must not be called inside that route callback.

`getServerConfig(): Promise<{ requireAuth: boolean }>` is also a plain async
function. It fetches `/api/config`. In the current implementation, a failed
request, unsuccessful response, or parse error falls back to
`{ requireAuth: false }`. This describes existing client behavior; server-side
authorization remains the server's responsibility.

## User and recent-board helpers: no hooks

[src/lib/user.ts](../src/lib/user.ts) exports these plain functions and a data
type:

| Export | Inputs and return | Behavior |
| --- | --- | --- |
| `getUser` | No arguments → `UserInfo` | Reads `kritzlboard:user`, or creates an adjective/animal name and cursor color; saves best-effort |
| `setUserName` | `name: string` → `UserInfo` | Trims the name, preserves/falls back to the existing identity, and saves best-effort |
| `getRecentBoards` | No arguments → `RecentBoard[]` | Reads anonymous device-local recents; returns an empty list when absent or JSON reading fails |
| `touchRecentBoard` | `id: string, name: string` → `void` | Places the board first with a new timestamp, deduplicates by ID, and keeps at most 24 entries |
| `removeRecentBoard` | `id: string` → `void` | Removes a board from the local recent list |
| `RecentBoard` | `{ id: string; name: string; at: number }` | A link/metadata record; `at` is an epoch-millisecond timestamp |

The module also performs a best-effort one-time key migration on import:
`oidadraw:user`, `oidadraw:recents`, and `oidadraw:style` become their
`kritzlboard:` equivalents when the newer key is absent, then the legacy key is
removed. Storage access failures are caught.

These helpers are not observable stores. Calling `setUserName` does not notify
React components or an existing connection. The application explicitly updates
both React state and connection presence after changing a name:

```tsx
import { useState } from "react"
import type { BoardStore } from "@/board/store"
import { getUser, setUserName } from "@/lib/user"

export function PresenceName({ store }: { store: BoardStore }) {
  const [user, setUser] = useState(getUser)

  return (
    <input
      aria-label="Your display name"
      value={user.name}
      onChange={(event) => {
        const next = setUserName(event.target.value)
        setUser(next)
        store.connection.setUser(next)
      }}
    />
  )
}
```

Storage is optional: when unavailable, identity and recents may not persist.
The functions do not add cross-tab storage subscriptions. Parsed local records
are not a substitute for authenticated account data or document contents.

## Existing application effects

[src/board/TopBar.tsx](../src/board/TopBar.tsx) combines the hooks above:

- `useBoardName(store)` drives the title input.
- `usePeers(store.connection)` drives other participant avatars.
- `useConnectionStatus(store)` drives the network label.
- `useSession()` decides account UI and how visits are recorded.
- A signed-in visit is recorded on the server after session loading completes.
- An anonymous visit updates local recents after session loading completes.
- Account-name changes update local identity, React state, and connection user
  presence.

[src/routes/index.tsx](../src/routes/index.tsx) similarly waits for session loading,
then reads anonymous recents or fetches account boards and merges in local
anonymous entries. Its asynchronous list effect uses a cancellation flag so
results from an obsolete effect do not update the current UI.

The board route in [src/routes/b.$boardId.tsx](../src/routes/b.$boardId.tsx)
uses `Route.useParams()` for the ID and a local state/effect pair to create and
destroy the application store. It does not use the local-only package
`useBoardStore`, because the application store also owns networking.

TanStack's `useNavigate`, `Route.useParams`, and `Route.useSearch` are
framework hooks used by the routes, not repository-defined board hooks. They
require the router context installed by
[src/main.tsx](../src/main.tsx). The package hooks do not depend on that context.

## Internal `useBoardController(options)`

This implementation hook is exported only from its source module, not from
`@kritzlboard/react`. The private `BoardSession` calls it once per provider
session with `BoardOptions`:

- Required core `store`.
- Optional transport-neutral `presence`.
- Optional `initialStyle`, merged into defaults once when state initializes.
- Optional `onStyleChange`, notified with the full current style.

Its return value is the private context value:

| Group | Fields |
| --- | --- |
| DOM refs | `rootRef`, `svgRef` |
| Observed snapshots | `shapes`, `peers` |
| Transient interaction state | `brushBox`, `eraseSet`, `bindingPreview`, `editingId`, `spaceDown` |
| Internal commands | `setEditingId`, `clearSpace` |
| Input handlers | `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerLeave`, `onDoubleClick` |
| Public surface | `editor`, typed by the exported `BoardEditor` contract |

The hook uses React state for camera, active tool, selection, editing ID, drawing
defaults, and overlay state. Refs retain the current pointer session, camera,
internal clipboard, and previous container size. Selected shapes are derived
from the store snapshot and selection set.

Effects and cleanup:

| Effect | Dependencies/purpose | Cleanup |
| --- | --- | --- |
| Shape and peer subscriptions | Supplied store/adapter | External-store unsubscription |
| Selection publication | Presence and selection | Presence cleanup below clears published selection |
| Style notification | Style and callback identity | None; callback may run again under Strict Mode |
| Presence lifetime | Adapter identity | Publish `null` cursor and an empty selection |
| Container measurement | Mounted root; observe resizes | Disconnect `ResizeObserver` |
| Browser blur handling | Root's owner window | Remove blur listener |
| Selection reconciliation | Shapes, selection, store; remove IDs no longer present | No cleanup function |
| Text-edit reconciliation | Shapes, editing ID, store; stop editing deleted targets | No cleanup function |
| Binding preview reset | Active tool; clear obsolete preview | No cleanup function |
| Keyboard handling | Current store, selection, editing actions | Remove root keydown/keyup listeners |
| Wheel handling | Mounted SVG and zoom behavior | Remove wheel listener |

Measurement and browser-listener effects operate after mount, so importing and
server-rendering the package does not require a DOM. Measurements use the root's
own dimensions, and text probes use the root's CSS context.

Do not mount several canvases under the same controller or swap its root/canvas
independently after the provider is initialized. Each provider owns one pair of
DOM refs and input listeners. To replace the editor surface, remount its provider
or supply a new document session.

The hook never destroys the supplied store or presence transport. It only
operates on their public APIs and cleans up its subscriptions/listeners. If
multiple providers share a store, they have separate controller state and
clipboard but share document mutations and undo history.

## Internal `useBoardContext()`

Defined in [context.tsx](../packages/react/src/context.tsx). It reads the private
context, throws the same missing-provider error as `useBoardEditor`, and returns
the full controller result. Internal canvas/root components use it to obtain
DOM refs, transient state, and handlers. Public controls should use the narrower
`useBoardEditor` API instead.

`BoardProvider` keys its private `BoardSession` using `store.doc.guid`, so a new
document GUID resets controller state. This identity is distinct from a board's
human-facing name or room ID.

## React primitives and stable dependencies

The implementation uses standard `useState`, `useEffect`, `useRef`,
`useCallback`, `useMemo`, `useContext`, and `useSyncExternalStore`. They retain
their ordinary React contracts; the repository does not wrap or redefine them.

For extensions:

1. Create disposable documents and network adapters in an effect or a deliberate
   external owner, and capture each created resource in that effect's cleanup.
2. Depend on the document ID, URL, and other values that should replace a session;
   avoid reconstructing resources because an unrelated parent rendered.
3. Use stable, bound subscription/getter functions and cached snapshots for
   `useSyncExternalStore`.
4. Keep server snapshots deterministic. Package peer snapshots are empty; store
   snapshots reflect the supplied document. The hook-created store starts null.
5. Preserve the ownership boundary: observation hooks unsubscribe, providers
   clean up view state, connection owners disconnect, and store owners destroy.
6. Observe async cancellation on route or account changes. A result belonging to
   an old session should not update the current document's UI.

See [React integration](react.md) for examples and
[application behavior](application.md) for the surrounding product flows.

