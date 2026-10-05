# Kritzlboard documentation

Kritzlboard is a collaborative SVG whiteboard and a set of reusable TypeScript packages. This handbook covers the shipped application, package APIs, React hooks, backend, persistence, and the code needed to maintain them.

## Start here

| You want to… | Read |
| --- | --- |
| Run the application or deploy it | [Getting started](getting-started.md) |
| Learn the board UI, sharing, accounts, and shortcuts | [Application guide](application.md) |
| Understand the package boundaries and data flow | [Architecture](architecture.md) |
| Embed a board in another React application | [React integration](react.md) |
| Look up a component's props or composition rules | [Complete component reference](../packages/react/docs/components.md) |
| Understand every public and application-specific hook | [Hooks reference](hooks.md) |
| Work directly with documents, shapes, or geometry | [Core API](core.md) |
| Add collaboration or implement a transport | [Synchronization](sync.md) |
| Work on HTTP endpoints, auth, SQL, or room persistence | [Server reference](server.md) |
| Change the code, run checks, or add a feature | [Development guide](development.md) |
| Try components and inspect their source | [Component playground](../examples/component-demo/README.md) |

## Repository map

| Location | Responsibility |
| --- | --- |
| [`packages/core/`](../packages/core/README.md) | Shape and style model, geometry, bindings, local Yjs document store |
| [`packages/react/`](../packages/react/README.md) | SVG rendering, editor interactions, components, hooks, standalone CSS |
| [`packages/sync/`](../packages/sync/README.md) | Optional WebSocket connection, awareness, peer snapshots, connection status |
| [`src/`](../src/main.tsx) | Product SPA: routing, identity, authentication, recent boards, preferences |
| [`server/`](../server/main.ts) | HTTP and WebSocket process, authentication, PostgreSQL storage, static hosting |
| [`scripts/dev.mjs`](../scripts/dev.mjs) | Local database startup and coordinated frontend/backend development |
| [`examples/react-embedding/`](../examples/react-embedding/main.tsx) | Minimal two-board embedding example |
| [`examples/component-demo/`](../examples/component-demo/README.md) | Interactive component and API playground |
| [`server/drizzle/`](../server/drizzle/meta/_journal.json) | Committed SQL migrations and migration metadata |

The implemented workspace packages are `@kritzlboard/core`, `@kritzlboard/react`, and `@kritzlboard/sync`. The product application still lives in the root project. The server has a runtime dependency manifest, but it is not yet an `@kritzlboard/server` workspace package. There is no separate `/application` package.

## A few boundaries to understand first

- A core `BoardStore` is an in-memory document. A matching board ID alone does not connect stores or persist their data.
- React owns each editor's camera, selection, tool, clipboard, and styles. The host owns the supplied document and optional connection.
- `@kritzlboard/sync` connects a supplied document to a server. The application adapter chooses the URL and current user.
- Board shapes and title are document data; cursor and selection presence are temporary awareness data.
- The product saves synchronized documents in PostgreSQL. Browser storage holds identity, style preferences, and anonymous recent-board metadata.
- A recent-board entry is a bookmark. Removing it does not delete the drawing.
- The application's authentication option gates the instance. There is no per-board owner/member permission system.

## Coverage and source of truth

The handbook documents every public package export and the application's own modules and hooks. Private React rendering/controller modules are described as implementation details, not supported import paths. The development guide explains where to change each concern and which tests exercise it.

The application and package reference was checked against source revision `bdbea87`. The component playground and detailed component reference were added afterwards in this workspace. Source links are repository-relative so they follow the checked-out code. When a public contract changes, update its reference and examples together.

Runtime code, exported TypeScript declarations, and tests remain the source of truth. These docs describe existing behavior and call out limitations; they do not promise unimplemented server extraction, read-only editing, durable offline browser storage, or a custom-shape registration API.

