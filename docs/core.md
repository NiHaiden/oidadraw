# Core: documents, shapes, and geometry

[Documentation](README.md) · [Architecture](architecture.md) · [React](react.md) · [Synchronization](sync.md)

`@kritzlboard/core` is the environment-independent document model. It provides shape
types, styling constants, coordinate and connector geometry, and a local
`BoardStore` backed by Yjs. Constructing a store starts no network connection and
accesses no browser storage. React rendering, pointer interaction, text
measurement, authentication, and persistence belong to other layers.

The package's [entry point](../packages/core/src/index.ts) exports every public
symbol from [types.ts](../packages/core/src/types.ts) and
[geometry.ts](../packages/core/src/geometry.ts), plus
[`BoardStore`](../packages/core/src/store.ts). The tables below cover all 59
exports. Internal helpers such as `BaseShape`, `shapeCenter`,
`closestOutlinePoint`, and `BIND_GAP` are not public imports.

## Create and edit a document

Supply stable, unique shape IDs and complete shape objects. `putShape` and
`putShapes` replace values by ID; they are not partial-patch APIs. This example
creates two nodes and a connector in one batch, then moves a node as a separate
undoable action:

```ts
import { BoardStore, translateShape } from "@kritzlboard/core"
import type { LineShape, RectShape } from "@kritzlboard/core"

const store = new BoardStore("workflow")
const firstOrder = store.nextOrder()

const idea: RectShape = {
  id: "idea",
  type: "rect",
  order: firstOrder,
  x: 0,
  y: 0,
  w: 160,
  h: 100,
  color: "blue",
  size: "m",
  fill: "semi",
  text: "Idea",
}

const result: RectShape = {
  ...idea,
  id: "result",
  order: firstOrder + 1,
  x: 320,
  color: "green",
  text: "Result",
}

const arrow: LineShape = {
  id: "flow",
  type: "arrow",
  order: firstOrder + 2,
  x: 160,
  y: 50,
  dx: 160,
  dy: 0,
  color: "grey",
  size: "m",
  startBinding: idea.id,
  startAnchor: { x: 1, y: 0.5, snap: "e" },
  endBinding: result.id,
  endAnchor: { x: 0, y: 0.5, snap: "w" },
}

store.putShapes([idea, result, arrow])
store.setBoardName("Workflow")

store.stopCapturing()
store.putShape(translateShape(idea, 0, 120))
// The attached arrow is updated in the same transaction.

store.undo() // Restores the node and connector together.
store.redo()

// Keep the store alive for its consumers. During host cleanup:
store.destroy()
```

Assign increasing `order` values within a batch. Repeated calls to
`nextOrder()` before inserting anything return the same value because the
document has not changed.

Two stores constructed with the same `boardId` remain independent. An ID labels
a document; a transport must explicitly synchronize it with another document.

## Coordinates and ordering

All stored geometry uses world coordinates. Positive x points right; positive y
points down. Rectangles, ellipses, freehand strokes, and text use a top-left
`x/y` and `w/h`. A line or arrow begins at `(x, y)` and ends at
`(x + dx, y + dy)`; either delta may be negative.

`Camera = { x, y, z }` describes the world coordinate visible at the canvas's
top-left and its zoom scale. At `z = 2`, one world unit occupies two screen
pixels:

```text
screen.x = (world.x - camera.x) * camera.z
screen.y = (world.y - camera.y) * camera.z
world.x  = screen.x / camera.z + camera.x
world.y  = screen.y / camera.z + camera.y
```

Screen coordinates passed to the conversion functions are relative to the
canvas. For a browser event, subtract the canvas's bounding rectangle
`left/top` before calling `screenToWorld`. These pure functions do not inspect
DOM offsets or validate zoom; provide a finite positive scale.

Shapes paint in increasing `order`, with higher values appearing on top.
`BoardStore` breaks equal-order ties by lexicographic ID comparison. Helpers that
scan an array for the topmost shape assume this paint order; they do not sort it.

Bounds describe stored geometry rather than the full painted extent. They do
not include stroke thickness, arrowheads, or label overflow. There are no
rotation, skew, group, image, or arbitrary matrix-transform fields in the current
shape model.

## Shape and editor types

The definitions live in [types.ts](../packages/core/src/types.ts). The following
common fields are present on every shape, although their shared `BaseShape`
interface is internal:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Unique key within a document. |
| `order` | `number` | Paint order; larger values paint later. |
| `color` | `ColorId` | Named palette entry used for stroke and fill colors. |
| `size` | `SizeId` | Stroke/pen size, and a legacy fallback for label font size. |

### Shape variants

| Export | Discriminant and fields | Behavior |
| --- | --- | --- |
| `RectShape` | `type: "rect"; x/y/w/h: number; fill: FillStyle; strokeStyle?: StrokeStyle; text?: string; font?: FontId; textSize?: TextSizeId` | Rectangular node with an optional centered label. The React renderer rounds corners; binding geometry follows that rounded outline for fixed anchors. |
| `EllipseShape` | `type: "ellipse"`; otherwise the same fields as `RectShape` | Ellipse within the stored bounding box, with an optional centered label. |
| `LineShape` | `type: "line" \| "arrow"; x/y/dx/dy: number; strokeStyle?: StrokeStyle; startBinding?/endBinding?: string; startAnchor?/endAnchor?: BindingAnchor; text?: string; font?: FontId; textSize?: TextSizeId` | Straight connector. An arrow adds a head at its end. Optional bindings attach either endpoint to a node. |
| `DrawShape` | `type: "draw"; x/y/w/h: number; points: number[]` | Freehand points encoded as flat `[x0, y0, x1, y1, ...]` offsets relative to the shape's `x/y`, normally spanning `0..w` and `0..h`. There is no pressure field. |
| `TextShape` | `type: "text"; x/y/w/h: number; text: string; fontSize: number; font?: FontId` | Standalone text with its own numeric font size. The exported type does not have `textSize`, `fill`, or `strokeStyle`. |
| `Shape` | `RectShape \| EllipseShape \| LineShape \| DrawShape \| TextShape` | Discriminated union accepted by store and geometry APIs. |
| `TextEditableShape` | `TextShape \| RectShape \| EllipseShape \| LineShape` | All shapes except freehand strokes. |

The package relies on callers to supply valid shape data. Its TypeScript types
are not a runtime schema validator. Use complete values, finite geometry, and
appropriate nonnegative dimensions when importing external data. Mutations to
a retrieved object's fields or a `DrawShape.points` array do not create Yjs
updates.

### Style and tool types

| Export | Definition |
| --- | --- |
| `ColorId` | `"black" \| "grey" \| "violet" \| "blue" \| "cyan" \| "green" \| "yellow" \| "orange" \| "red"` |
| `FillStyle` | `"none" \| "semi" \| "solid"` |
| `StrokeStyle` | `"solid" \| "dashed" \| "dotted"` |
| `SizeId` | `"s" \| "m" \| "l"` |
| `TextSizeId` | `"s" \| "m" \| "l" \| "xl"` |
| `FontId` | `"sans" \| "hand"` |
| `PaletteEntry` | `{ stroke: string; fill: string }` |
| `ToolId` | `"select" \| "hand" \| "draw" \| "rect" \| "ellipse" \| "line" \| "arrow" \| "text" \| "eraser"` |
| `StyleDefaults` | `{ color: ColorId; fill: FillStyle; strokeStyle: StrokeStyle; size: SizeId; font: FontId; textSize: TextSizeId }` |

`StyleDefaults` describes editor preferences, not a complete shape. The core
exports the type but does not create or persist a default style object.
[The React editor](react.md) initializes those preferences and decides which
properties apply to each shape.

### Coordinates, binding, and presence types

| Export | Definition and meaning |
| --- | --- |
| `Point` | `{ x: number; y: number }`, exported from geometry.ts. |
| `Box` | `{ x: number; y: number; w: number; h: number }`, exported from geometry.ts. |
| `Camera` | `{ x: number; y: number; z: number }`; world origin and zoom. |
| `BindingPointId` | `"nw" \| "n" \| "ne" \| "e" \| "se" \| "s" \| "sw" \| "w"`; eight outline snap locations. |
| `BindingAnchor` | `{ x: number; y: number; snap?: BindingPointId }`; normalized coordinates within a target's bounds, optionally preserving a named outline point. |
| `HandleId` | Alias of `BindingPointId`, exported from geometry.ts; used for selection resize handles. |
| `UserInfo` | `{ name: string; color: string }`; presentation identity for presence. The color is a string, not restricted to `ColorId`. |
| `PeerState` | `{ clientId: number; user: UserInfo; cursor: { x: number; y: number } \| null; selection: string[] }`; peer cursor in world coordinates and selected shape IDs. |

Presence types are shared contracts. `BoardStore` does not own or broadcast
presence. See [synchronization](sync.md) for the transport.

## Styling constants and compatibility helpers

### Palette and size constants

| Export | Type | Values or purpose |
| --- | --- | --- |
| `PALETTE` | `Record<ColorId, PaletteEntry>` | Stroke and fill colors listed below. |
| `COLOR_IDS` | `ColorId[]` | Palette keys in declaration order: black, grey, violet, blue, cyan, green, yellow, orange, red. |
| `STROKE_WIDTHS` | `Record<SizeId, number>` | `s: 2, m: 3.5, l: 6` world units. |
| `PEN_SIZES` | `Record<SizeId, number>` | `s: 4, m: 8, l: 14` freehand pen diameters. |
| `FONT_SIZES` | `Record<SizeId, number>` | `s: 18, m: 28, l: 44` for legacy labels without `textSize`. |
| `TEXT_FONT_SIZES` | `Record<TextSizeId, number>` | `s: 18, m: 28, l: 44, xl: 72`. |
| `FONT_STYLES` | `Record<FontId, { fontFamily: string; fontWeight: number }>` | `sans`: `var(--font-sans)`, weight 400; `hand`: `var(--font-hand)`, weight 600. |
| `DEFAULT_FONT` | `FontId` | `"sans"`. |
| `DEFAULT_TEXT_SIZE` | `TextSizeId` | `"m"`; an editor default, not an override for every older shape. |

| Palette key | Stroke | Fill |
| --- | --- | --- |
| `black` | `#1d1d1d` | `#e8e8e8` |
| `grey` | `#758195` | `#e9edf1` |
| `violet` | `#7048c6` | `#e5dcf8` |
| `blue` | `#3667e8` | `#dae2fa` |
| `cyan` | `#0e98ad` | `#d8eef1` |
| `green` | `#099268` | `#d5ebe3` |
| `yellow` | `#e0a300` | `#f9f0d4` |
| `orange` | `#e16919` | `#f8e2d4` |
| `red` | `#e03131` | `#f6dcdc` |

These constants are ordinary exported objects and arrays. Treat them as
read-only. Core does not load fonts or inject CSS. Its `FONT_STYLES` retains
the older `--font-sans` and `--font-hand` variable names. The React package
uses its own [typography mapping](../packages/react/src/typography.ts) with
`--kb-font-sans` and `--kb-font-hand` for embedding; do not assume the two
variable names are interchangeable.

### Compatibility functions

| Signature | Behavior |
| --- | --- |
| `shapeFont(shape: Shape): FontId` | Uses `shape.font` when present, otherwise `DEFAULT_FONT`. |
| `shapeFontSize(shape: Shape): number` | Uses `TEXT_FONT_SIZES[shape.textSize]` when that optional field is present; otherwise a standalone text shape's `fontSize`, or `FONT_SIZES[shape.size]` for labels. |
| `isTextEditable(shape: Shape): shape is TextEditableShape` | Type guard that excludes only `draw`. |

Older documents can omit `font`, label `textSize`, label text, or
`strokeStyle`. The font helpers preserve those document values rather than
rewriting them. The React renderer treats absent `strokeStyle` as solid.
Standalone `TextShape` uses numeric `fontSize`; a label's absent `textSize`
follows the shape's `size`, even though the new editor's default text size is
medium.

## BoardStore API

The implementation is in [store.ts](../packages/core/src/store.ts).

### Construction and public fields

| Member | Type or signature | Meaning |
| --- | --- | --- |
| `new BoardStore(boardId)` | `constructor(boardId: string)` | Creates one new, empty Yjs document and its local undo history. |
| `boardId` | `readonly string` | Caller-supplied document label, commonly used as a sync room ID. |
| `doc` | `readonly Y.Doc` | Owned Yjs document. A transport or persistence layer can attach here. |
| `yShapes` | `readonly Y.Map<Shape>` | Named `"shapes"`; each entry stores one complete shape object under its ID. |
| `yMeta` | `readonly Y.Map<string>` | Named `"meta"`; the current board title is stored at key `"name"`. |
| `undoManager` | `readonly Y.UndoManager` | History for `yShapes` transactions carrying this store's origin. |
| `origin` | `readonly symbol` | Unique `Symbol("local")` used by `transact` to identify local shape edits. |

`readonly` prevents replacing a field reference in TypeScript; it does not make
the Yjs document or map immutable. Prefer public mutation methods. Writing raw
`yShapes` bypasses local connector write-through and, unless using the local
origin, bypasses local undo tracking.

### Queries and subscriptions

| Signature | Behavior |
| --- | --- |
| `getShapes(): Shape[]` | Returns the cached, ordered, display-ready snapshot. Same array until shapes change. |
| `getShape(id: string): Shape \| undefined` | Looks up a shape from that same display-ready snapshot. |
| `getBoardName(): string` | Reads `yMeta.get("name")`, falling back to an empty string. |
| `getCanUndo(): boolean` | Whether the local undo manager can undo. |
| `getCanRedo(): boolean` | Whether the local undo manager can redo. |
| `subscribe(listener: () => void): () => boolean` | Adds a listener. Calling the returned function removes it; its boolean return is just `Set.delete`'s result and can be ignored. |
| `nextOrder(): number` | Returns one greater than the maximum order, with a starting maximum of zero; an empty store returns 1. |

`subscribe`, `getShapes`, `getBoardName`, `getCanUndo`, and `getCanRedo`
are arrow-function fields and can be passed directly to subscription APIs.
Other methods should retain their receiver, for example
`() => store.undo()`.

Subscribers receive no event payload. They are notified when shapes or metadata
change and when undo-stack events occur, so one user action may cause several
notifications. Re-read the needed snapshots rather than counting callbacks as
editing actions.

### Mutations, history, and teardown

| Signature | Behavior |
| --- | --- |
| `putShape(shape: Shape): void` | Inserts or replaces one shape through `putShapes`. |
| `putShapes(shapes: Shape[]): void` | Computes the final batch plus affected connectors, then writes them in one local transaction. |
| `deleteShapes(ids: Iterable<string>): void` | Deletes IDs in one local transaction and preserves surviving bound connectors' visible geometry before deleting targets. |
| `transact(fn: () => void): void` | Calls `doc.transact(fn, origin)`. Marks grouped shape changes as local for undo. |
| `setBoardName(name: string): void` | Sets `yMeta["name"]` in a document transaction. Title changes are outside shape undo history. |
| `stopCapturing(): void` | Ends capture of the previous undo group, before an independent edit. |
| `undo(): void` | Delegates to the undo manager. |
| `redo(): void` | Delegates to the redo manager. |
| `destroy(): void` | Clears subscribers and destroys the undo manager and document. Repeated calls are harmless. |

Use `putShapes` for a group move or resize. Connector layout sees all new node
values together, including nodes and connectors inserted in the same batch.
The batch may list connectors before their targets.

`transact` provides transaction grouping but is not a validation or connector
layout function. If working directly with maps, you are responsible for those
extra invariants. Call `stopCapturing()` before each independent action when
separate undo steps are required. It creates a history boundary; it does not
commit a document or clear all undo history. To discard seeded history, the
publicly exposed `store.undoManager.clear()` is available.

The undo manager scopes only `yShapes` and tracks only this store's unique
`origin`. Applying a remote Yjs update without that origin does not create
local undo history. Board names are stored in `yMeta`, outside the scope, so
renaming is not reversed by `store.undo()`.

### Cached snapshots and connector convergence

On each `yShapes` change, the store:

1. Collects map values and sorts them by `order`, then ID.
2. Builds an ID lookup of the stored shapes.
3. Recomputes visible line and arrow endpoints against the current targets.
4. Caches the ordered array and its lookup, then notifies subscribers.

Consumers must treat arrays, shapes, and nested point arrays as immutable
snapshots. They are not frozen or deep-cloned, and the return types are ordinary
arrays. Create replacement values and call `putShape`/`putShapes` to edit.

Remote updates can combine a moved node with a connector whose stored endpoint
geometry is older. Snapshot derivation corrects the visible connector without
writing another shared update or adding undo history. As a result,
`store.getShape(id)` and `store.yShapes.get(id)` can legitimately contain
different endpoint coordinates. Use `getShapes`/`getShape` for rendering and
geometry inspection; use the Yjs document when exchanging or persisting updates.

Deleting an attached node does not automatically delete its connectors or erase
their binding IDs. Before deletion, local `deleteShapes` writes surviving
connectors' current displayed geometry. Missing targets are then treated as
dangling bindings. Undo can restore the node and reattach the connector at its
existing anchor.

### Lifecycle and ownership

The store owns its `Y.Doc`; its constructor does not accept an externally
created document. To load an existing Yjs document state, apply the update to
`store.doc`. For a content snapshot import, construct valid shapes and use
`putShapes`, keeping in mind that this is a local edit and participates in
undo history.

The host that constructs the store destroys it. Disconnect/destroy attached
transports and persistence listeners before calling `store.destroy()`; do not
continue using a destroyed store. [React's `useBoardStore`](react.md) handles
that ownership when it creates the store for a mounted component.
`Board` and `BoardProvider` do not destroy a supplied store.

No methods enforce a read-only document, authenticate mutations, or persist
changes. Those policies belong to the host or [server](architecture.md).

## Geometry API

All functions in [geometry.ts](../packages/core/src/geometry.ts) operate on
plain values and have no DOM or storage dependency. They return computed values
rather than modifying their inputs. Some no-op paths return the original shape
reference, so do not infer a mutation from object identity alone.

### Coordinates, bounds, and transformations

| Signature | Behavior |
| --- | --- |
| `screenToWorld(p: Point, camera: Camera): Point` | Converts canvas-relative pixels into world coordinates. |
| `worldToScreen(p: Point, camera: Camera): Point` | Converts world coordinates into canvas-relative pixels. |
| `boxFromPoints(a: Point, b: Point): Box` | Creates normalized bounds using minimum x/y and absolute coordinate differences. Zero width or height is possible. |
| `boxesIntersect(a: Box, b: Box): boolean` | Axis-aligned intersection; touching edges count as intersection. Assumes normalized boxes. |
| `getShapeBounds(shape: Shape): Box` | Uses stored x/y/w/h for box-like shapes; normalizes the two endpoints for a line or arrow. |
| `getCommonBounds(shapes: Shape[]): Box \| null` | Union of geometric bounds, or `null` for an empty array. |
| `translateShape<TShape extends Shape>(shape: TShape, dx: number, dy: number): TShape` | Returns a shallow copy with x/y offset. Keeps line deltas, bindings, and relative freehand points unchanged. |
| `resizeShape(shape: Shape, from: Box, to: Box): Shape` | Maps geometry between reference boxes. Both reference boxes should have positive dimensions. Detailed shape rules are below. |
| `snapAngle(dx: number, dy: number, step: number): Point` | Rounds a vector's angle to a multiple of `step` radians while preserving length; a zero vector stays zero. Supply a positive nonzero step. |

`resizeShape` scales rectangles and ellipses independently on each axis, with
each output dimension clamped to at least 1. Lines and arrows scale their
start position and deltas independently. Freehand strokes scale their relative
point array per axis and clamp w/h to at least 1.

Standalone text uses a uniform scale: the smaller axis scale, clamped so
`fontSize` cannot fall below 8. Its width, height, and font size share that
scale; its position still follows the reference-box mapping. Resizing does not
scale stroke widths, change the shape's size token, or resize labels' font
tokens. It preserves binding IDs and anchors; writing the result through the
store can re-derive a bound endpoint against its target.

```ts
import {
  getCommonBounds,
  resizeBox,
  resizeShape,
  screenToWorld,
  snapAngle,
} from "@kritzlboard/core"
import type { BoardStore, Camera, Point } from "@kritzlboard/core"

export function resizeSelection(
  store: BoardStore,
  selectedIds: ReadonlySet<string>,
  screenPoint: Point,
  camera: Camera,
) {
  const shapes = store.getShapes().filter((shape) => selectedIds.has(shape.id))
  const from = getCommonBounds(shapes)
  if (!from || from.w <= 0 || from.h <= 0) return

  // screenPoint is relative to the canvas, not the browser viewport.
  const worldPoint = screenToWorld(screenPoint, camera)
  const to = resizeBox(from, "se", worldPoint)

  store.stopCapturing()
  store.putShapes(shapes.map((shape) => resizeShape(shape, from, to)))
}

const diagonal = snapAngle(80, 50, Math.PI / 4) // Nearest 45-degree direction.
```

### Resize handles

| Export or signature | Behavior |
| --- | --- |
| `HANDLE_IDS: HandleId[]` | Clockwise order `nw, n, ne, e, se, s, sw, w`. |
| `HANDLE_CURSORS: Record<HandleId, string>` | `nw/se: nwse-resize`; `ne/sw: nesw-resize`; `n/s: ns-resize`; `e/w: ew-resize`. |
| `getHandlePosition(box: Box, handle: HandleId): Point` | Returns a corner or edge midpoint on the box. |
| `resizeBox(from: Box, handle: HandleId, p: Point): Box` | Moves only the named edges toward p while holding the opposite edges fixed. Prevents inversion by clamping dragged edges to keep at least one unit of width/height. |

Resize handles are on the selection box. Connector snap points use actual
visible node outlines, so their corner coordinates differ for ellipses and
rounded rectangles.

### Connector discovery and anchors

| Signature | Behavior |
| --- | --- |
| `getBindingMargin(zoom: number): number` | Returns `12 / Math.max(zoom, 1e-6)` world units, preserving a twelve-screen-pixel search radius. |
| `isBindable(shape: Shape): boolean` | True for rectangles and ellipses only; it is a boolean check, not a TypeScript narrowing predicate. |
| `getBindingPoints(shape: Shape): Array<{ id: BindingPointId; point: Point }>` | Eight named points on an ellipse or rounded-rectangle outline. Use bindable shapes. |
| `getBindingAnchor(shape: Shape, pointer: Point, zoom: number, toward?: Point): { anchor: BindingAnchor; point: Point; snapPointId?: BindingPointId }` | Finds the closest outline point or snaps near a named point. Returns both the world point and a persistable normalized anchor. |
| `resolveBindingAnchor(shape: Shape, anchor: BindingAnchor): Point` | Resolves a saved anchor against current target geometry. Named snaps take priority; free anchors are clamped to normalized bounds and projected back onto the outline. |
| `bindTargetAt(point: Point, shapes: Shape[], margin?: number, excludeId?: string): Shape \| undefined` | Scans from the end for a bindable target containing the point or within the margin. Default margin is 8 world units. Skips `excludeId`. |

Pass `store.getShapes()` to `bindTargetAt` to preserve paint-order targeting.
For consistent interaction across zoom levels, pass
`getBindingMargin(camera.z)` instead of relying on the fixed default of 8.

Ellipse hit testing measures distance from its curved outline, so empty corners
of its bounding box do not count as inside. Rectangles use their bounding box
and distance to that box for target discovery. After selecting a rectangle,
`getBindingAnchor` resolves its actual rounded perimeter.

The eight named locations are derived from the renderer's geometry. Ellipse
corners lie at 45-degree directions on the ellipse. Rounded-rectangle corners
use a radius of `min(6, w / 4, h / 4)`; their snap points lie on the arcs.
A pointer within twelve screen pixels of a named point snaps to it. Being deep
inside a large node does not trigger a named snap merely because the pointer's
outline projection happens to be near one.

At the exact center of a node, the nearest attachment can be ambiguous. Supply
`toward` as the opposite endpoint to select an outline point in that direction.
This special case preserves direction even for a tiny node entirely within the
normal snap radius.

A saved free anchor stores proportional x/y coordinates in the target's box.
Moving and resizing the target resolves those coordinates against its new
outline. A saved named anchor carries `snap`, preserving the meaning of
“northeast corner” even when the rounded corner radius changes.

```ts
import {
  bindTargetAt,
  getBindingAnchor,
  getBindingMargin,
} from "@kritzlboard/core"
import type { BoardStore, Camera, LineShape, Point } from "@kritzlboard/core"

export function attachArrowEnd(
  store: BoardStore,
  arrow: LineShape,
  worldPointer: Point,
  camera: Camera,
) {
  const target = bindTargetAt(
    worldPointer,
    store.getShapes(),
    getBindingMargin(camera.z),
    arrow.startBinding,
  )
  if (!target) return

  const attachment = getBindingAnchor(
    target,
    worldPointer,
    camera.z,
    { x: arrow.x, y: arrow.y },
  )

  store.stopCapturing()
  store.putShape({
    ...arrow,
    endBinding: target.id,
    endAnchor: attachment.anchor,
    dx: attachment.point.x - arrow.x,
    dy: attachment.point.y - arrow.y,
  })
}
```

The example deliberately excludes the current start target. The core helper
does not automatically impose that policy; callers choose the exclusion.

### Connector layout and older documents

| Signature | Behavior |
| --- | --- |
| `edgePoint(shape: Shape, toward: Point, gap?: number): Point` | Intersects a ray from the shape center toward `toward` with an ellipse or box, then extends it by `gap` world units along the ray. Default gap: 6. If the direction is effectively zero, returns the center. |
| `layoutBoundLine(line: LineShape, getShape: (id: string) => Shape \| undefined): LineShape` | Resolves existing targets and recomputes endpoint coordinates. Explicit anchors remain fixed on the outline; bindings without anchors use center-directed legacy positioning. Missing targets are ignored. |
| `updateBoundLines(changed: Shape[], all: Shape[]): Shape[]` | Returns changed shapes plus affected bound lines/arrows, with endpoints recomputed from the final changed values. |

`layoutBoundLine` preserves free endpoints. With no resolvable target on either
end, it returns the original line. With explicit anchors at both ends, each
anchor resolves independently. With one legacy end, that end aims toward the
opposite explicit anchor or free endpoint, or toward the opposite target's
center if both ends are legacy.

Legacy bindings have a target ID but no anchor. They retain the historical
6-world-unit gap from the target, while new fixed anchors sit directly on the
outline. `edgePoint` uses a rectangle's box rather than its rounded corner
perimeter; use `getBindingAnchor` for new outline attachments.

`updateBoundLines` treats a connector as affected when it is itself changed or
one of its bound targets appears in `changed`. Values from `changed` override
those from `all` while computing endpoints. Include the complete final shape
collection in `all`, including newly inserted connectors; the store constructs
that collection for `putShapes`. This is a direct binding update, not a
recursive graph-routing engine. Bindable UI targets are rectangles and
ellipses, and connectors remain straight.

## Tests and code navigation

[Store tests](../packages/core/src/store.test.ts) demonstrate document
independence even for matching IDs, subscription cleanup, idempotent teardown,
undo boundaries, batching both connector targets in one transaction, and
undo/redo of nodes with attached connectors. They also cover remote node-only
updates, concurrent peer movement, fixed anchors, and deleting/restoring a
remotely moved target without making its connector jump.

[Geometry tests](../packages/core/src/geometry.test.ts) cover negative line
deltas, empty common bounds, noninverting resize handles, shape scaling,
zero-vector angle snapping, ellipse outline hit tests, zoom-independent snap
radii, arbitrary and named anchors, centered attachment direction, and finite
results for tiny or flat ellipse dimensions.

The division of responsibilities is intentional:

| Concern | Location |
| --- | --- |
| Data contracts and styling values | [types.ts](../packages/core/src/types.ts) |
| Pure bounds, resize, target discovery, and binding geometry | [geometry.ts](../packages/core/src/geometry.ts) |
| Document storage, derived snapshots, and local history | [store.ts](../packages/core/src/store.ts) |
| Rendering, gestures, focus, keyboard shortcuts, and text measurement | [React documentation](react.md) |
| Connecting a document and publishing presence | [Synchronization documentation](sync.md) |
| Product routes, persistence policy, and authentication | [Application documentation](application.md) |

Continue with [React components and hooks](react.md) to embed the model in a
canvas, or [architecture](architecture.md) for the complete application flow.

