# @kritzlboard/core

Shape types, style constants, geometry, connector layout, and a local Yjs board
store. The package has no React, DOM, storage, authentication, or network setup.
Its only runtime dependency is Yjs.

```ts
import { BoardStore, getShapeBounds } from "@kritzlboard/core"

const store = new BoardStore("my-board")
const unsubscribe = store.subscribe(() => {
  console.log(store.getShapes())
})

store.putShape({
  id: "rectangle-1",
  type: "rect",
  order: 1,
  color: "black",
  size: "m",
  fill: "none",
  x: 0,
  y: 0,
  w: 160,
  h: 120,
})

console.log(getShapeBounds(store.getShape("rectangle-1")!))
store.stopCapturing() // subsequent edits begin a separate undo group
store.undo()

unsubscribe()
store.destroy()
```

## Document ownership and collaboration

Each store owns a fresh `Y.Doc`, including when two stores use the same board ID.
Shapes and metadata keep the existing `shapes` and `meta` Y.Map names, so existing
board documents remain compatible. `getShapes()` returns a cached snapshot in
paint order with resolved connector endpoints; treat the snapshot as read-only.
Use `putShape`, `putShapes`, and `deleteShapes` for edits that maintain bindings.

Use `store.doc` to attach a Yjs transport or to save and restore binary state with
`Y.encodeStateAsUpdate` and `Y.applyUpdate`. Applying an update merges document
state; it does not replace the document. Remote updates are excluded from local
undo history. Board names retain the existing behavior of being outside shape
undo history.

The caller owns any attached transport and must destroy it before calling
`store.destroy()`. Destroying a store is idempotent. Do not reuse it afterward.

The current application's `src/board/store.ts` extends this store with WebSocket
sync, presence, and React subscriptions. Those integrations are deliberately
outside this package. DOM text measurement and React rendering also remain in
the application.

## Development

From the repository root:

```sh
pnpm --filter @kritzlboard/core build
pnpm --filter @kritzlboard/core test
pnpm --filter @kritzlboard/core typecheck
```

The package exports compiled ESM and TypeScript declarations from `dist/`.
Root build, test, and typecheck commands build it first. `pnpm dev:web` builds
it once and watches package source alongside Vite. The package is available as
a local workspace dependency; it has not been published to a registry.
