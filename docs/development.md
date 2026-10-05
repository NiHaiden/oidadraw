# Development and maintenance

[Documentation home](README.md) · [Setup](getting-started.md) · [Architecture](architecture.md) · [Application](application.md)

## Toolchain and workspace

The root project is an ESM TypeScript application. It uses pnpm workspaces, Vite, React, TanStack Router, Tailwind, Vitest, and ESLint. Node executes the backend's TypeScript directly.

The package manager is recorded as `pnpm@11.20.0`. The Docker image uses Node 26. The root Node engine floor is `>=23.6`.

`pnpm-workspace.yaml` includes `packages/*`. The three packages expose compiled ESM and declarations from `dist/`; the React package also exposes `@kritzlboard/react/styles.css`. Import packages by their public names rather than aliases into another package's source.

```text
repository/
  packages/core/       shape model, geometry, local document
  packages/react/      canvas, editor, controls, hooks, CSS
  packages/sync/       optional transport and awareness
  src/                 product SPA
  server/              backend and SQL migrations
  scripts/             development orchestration
  examples/            embedding and component examples
  docs/                application and API handbook
```

## Commands

Run these from the repository root unless a package filter is shown.

| Command | What actually runs |
| --- | --- |
| `pnpm dev` | Loads optional .env, starts dev PostgreSQL if needed, then frontend/package watchers and backend watch process |
| `pnpm dev:web` | Builds all packages, watches all three packages, runs Vite on 3000 with strict port selection |
| `pnpm dev:sync` | `node --watch server/main.ts`; does not start PostgreSQL or load .env itself |
| `pnpm db:up` | Starts development PostgreSQL and waits for health |
| `pnpm db:down` | Stops development PostgreSQL without deleting its volume |
| `pnpm build:core` | Compiles core to its dist directory |
| `pnpm build:packages` | Builds core, then React, then sync |
| `pnpm build` | Builds packages and the Vite product client into root dist |
| `pnpm start` | Runs server/main.ts; expects configuration, database, and built frontend |
| `pnpm preview` | Vite's build preview, not the production auth/sync backend |
| `pnpm test` | Builds packages, then runs Vitest |
| `pnpm typecheck` | Builds packages, then runs root TypeScript checking without emitting |
| `pnpm lint` | Runs ESLint |
| `pnpm check` | Checks formatting of JS/TS/JSX/TSX files |
| `pnpm format` | Rewrites formatting of JS/TS/JSX/TSX files |

The root format/check scripts do not include Markdown. To check documentation formatting explicitly:

```sh
pnpm exec prettier --check "docs/**/*.md" packages/react/docs/components.md
```

### Run a focused package workflow

```sh
pnpm build:packages
pnpm --filter @kritzlboard/core test
pnpm --filter @kritzlboard/react test
pnpm --filter @kritzlboard/sync test
```

Each package also has `build`, `dev`, `typecheck`, and `prepack` scripts. Package tests use their own Vitest configuration; build dependencies first when testing a package independently.

Examples of focused root checks:

```sh
pnpm exec vitest run src/board/store.test.ts
pnpm exec vitest run packages/core/src/geometry.test.ts
pnpm exec vitest run examples/component-demo/src
```

## Compiled package development

The application and examples resolve package entry points from `dist/`. Editing `packages/react/src/Board.tsx` alone does not change that compiled output.

`pnpm dev:web` builds first and starts all watchers. The React watcher also copies its stylesheet into dist. The root Vite plugin groups package-output changes and performs a full reload after a short delay, because a TypeScript rebuild can replace related modules such as React contexts separately.

For the standalone component demo, run its Vite configuration and start the relevant package watchers in additional terminals, or rebuild packages manually. See its [README](../examples/component-demo/README.md).

A full reload recreates browser state. The product reconnects to its saved server document; local-only examples start new documents.

## TypeScript, imports, and generated files

The root TypeScript configuration includes source and tests, enables strict checking, uses bundler module resolution, and declares the `@/*` alias for `src/*`. That alias belongs to the application, not the package API.

Package build configurations emit JavaScript and declarations. Package source uses runtime-compatible relative `.js` import specifiers for emitted ESM; follow each package's existing convention. The backend uses Node-compatible imports and cannot rely on Vite-only aliases.

Treat these files as generated output:

| File or directory | Owner |
| --- | --- |
| `src/routeTree.gen.ts` | TanStack Router Vite plugin |
| `packages/*/dist/` | Package TypeScript builds and React CSS copy script |
| Root `dist/` | Vite product build |
| `examples/component-demo/dist/` | Demo Vite build |
| `*.tsbuildinfo` | TypeScript incremental state |
| `server/drizzle/meta/*` and generated SQL migrations | Drizzle migration generation; generated files are reviewed and committed |

Do not manually patch generated package output or the route tree to implement a source change. SQL migrations are different: their generated content is a reviewed part of the repository and deployment history.

The Prettier configuration uses double quotes, no semicolons, two-space indentation, and an 80-column print width. Its Tailwind plugin handles class ordering in the application stylesheet context. ESLint and TypeScript are complementary checks; a successful build does not replace them.

## Test map

| Test location | Contract exercised |
| --- | --- |
| [core/types.test.ts](../packages/core/src/types.test.ts) | Model/style compatibility helpers |
| [core/geometry.test.ts](../packages/core/src/geometry.test.ts) | Coordinates, bounds, transforms, hit/binding geometry, connector layout |
| [core/store.test.ts](../packages/core/src/store.test.ts) | Local document, transactions, undo, subscriptions, connector convergence, lifecycle |
| [react/Board.test.tsx](../packages/react/src/Board.test.tsx) | Drawing/editor behavior and interactions |
| [react/embedding.test.tsx](../packages/react/src/embedding.test.tsx) | Embedding, independent editors, focus, host sizing/composition |
| [react/ssr.test.tsx](../packages/react/src/ssr.test.tsx) | Server-rendering compatibility of supported package entry points |
| [sync/connection.test.ts](../packages/sync/src/connection.test.ts) | Adapter options, stable snapshots, status/presence, lifecycle |
| [sync/provider.test.ts](../packages/sync/src/provider.test.ts) | Integration with the provider behavior |
| [application store.test.ts](../src/board/store.test.ts) | Product URL/user policy and connection-before-document cleanup |
| [demo examples.test.tsx](../examples/component-demo/src/examples.test.tsx) | Composed controls and host-owned selection actions |
| [demo presence.test.ts](../examples/component-demo/src/presence.test.ts) | Local presence subscriptions, snapshots, isolation, and copied input values |

The package configurations use Node for core/sync and jsdom for React. The current tree does not contain a dedicated backend HTTP/database test suite or a browser end-to-end suite. Unit tests cannot establish production proxy behavior or database durability.

Choose tests that exercise the changed contract. A geometry fix belongs in geometry/store tests; a focus regression belongs in embedding tests; connection cleanup belongs in sync/application adapter tests. For visual or native-pointer changes, also use a browser because jsdom does not provide real layout or full browser interaction behavior.

### Manual integration checks

For changes crossing editor, application, or server boundaries:

1. Run the full application with a real database.
2. Open the same room in two windows and edit from both.
3. Check shape movement, bound connectors, text labels, undo, and peer selection.
4. Navigate between board IDs and verify the old connection is released.
5. Reload and verify saved shapes and title are restored.
6. Check signed-in and signed-out recent lists separately.
7. If auth or topology changed, test the public origin and WebSocket route through the actual proxy.
8. For embedding changes, test two independent boards beside an ordinary host input and resize their containers.

Keep validation results specific: distinguish typechecking, unit tests, a static build, browser checks, and checks that required a running backend.

## Change a feature in the right layer

### Add or change a shape

1. Update the discriminated model and relevant defaults/helpers in [core/types.ts](../packages/core/src/types.ts).
2. Implement bounds, transformations, hit/binding behavior in [core/geometry.ts](../packages/core/src/geometry.ts) as appropriate.
3. Review store transactions, connector updates, snapshots, and undo in [core/store.ts](../packages/core/src/store.ts).
4. Update [ShapeView](../packages/react/src/ShapeView.tsx), selection rendering, and any text rendering/editing path.
5. Add the creation/editing session to [useBoardController](../packages/react/src/useBoardController.ts) and its controls if the shape is user-creatable.
6. Add tests at the model/geometry/store/editor boundary affected by the new behavior.
7. Update the [core reference](core.md), [React reference](react.md), and a demo example.

There is no runtime custom-shape registry. Adding a new shape family currently means changing the union and its consumers.

Existing documents are persisted Yjs data. New required fields need an explicit compatibility strategy; type declarations do not backfill old snapshots. Follow the existing optional style fields and fallback helpers when extending old shape formats.

### Add a tool or editor action

Start with `ToolId` if introducing a tool, then the controller's pointer session and keyboard behavior, the toolbar, and style-panel visibility. Keep hit thresholds consistent with the world's zoom conversion.

For an action, decide whether it operates on shared document data or local editor state. Expose supported host actions through `BoardEditor`; do not make consumers import the private controller. Preserve undo boundaries for one user gesture and clean up pointer/presence state on unmount.

Update the [hooks reference](hooks.md), [component reference](../packages/react/docs/components.md), and relevant demo if a public action changes.

### Add a product route or control

Add or change a file under `src/routes/`; let the router plugin regenerate `routeTree.gen.ts`. Keep authentication, browser storage, URLs, and account UI in the product layer.

Use the application `Button` and theme for product controls. Use the React package's public components/hooks when extending board UI. A route owning a document must destroy it on unmount or ID change and avoid rendering the old document under a new route ID.

### Add or change synchronization

Work in `packages/sync/` for transport/presence contracts, in `src/board/store.ts` for product URL/identity policy, and in the backend for wire authorization and room persistence.

Keep `getPeers()` snapshots stable between changes and return an unsubscribe function from subscriptions. A presence update is not a document update. A disconnected provider does not imply the document should be destroyed.

Review cleanup ownership carefully when injecting providers or awareness. Add connection/provider tests and update [Synchronization](sync.md).

### Add a backend endpoint

The backend routes HTTP requests in `server/main.ts` alongside auth, health, and static hosting. Define method/path, validation, authorization, response type, and error behavior before extending the dispatch.

Do not treat `user_boards` as a permission table: it currently records visits/bookmarks. If introducing per-board access control, enforce it in both HTTP and WebSocket paths and explicitly define what existing shared links mean.

Update the [server endpoint reference](server.md) and corresponding frontend helper. For state changes, test against PostgreSQL as well as any isolated helper tests.

## Database migrations

[server/schema.ts](../server/schema.ts) contains application tables and reexports the auth schema. [server/auth-schema.ts](../server/auth-schema.ts) defines the auth tables. [drizzle.config.ts](../drizzle.config.ts) points generation at the schema and `server/drizzle/`.

After changing the schema:

```sh
pnpm exec drizzle-kit generate
```

Review and commit the generated SQL, snapshot, and journal changes together with the schema. Inspect destructive or data-transforming SQL before applying it to a database with existing boards or accounts.

The backend runs migrations on startup before listening. A migration failure prevents normal startup. Do not edit an already-applied migration as a substitute for creating a new one.

For document-format changes, SQL migrations alone are insufficient: board state is encoded Yjs data inside a database column. Define decoding/default compatibility or a deliberate document migration separately.

## Production packaging

The Docker build stage installs workspace dependencies and builds the frontend. Its runtime stage installs dependencies from `server/package.json`, copies the backend TypeScript and migration files, and copies the built frontend.

A new backend runtime dependency may need changes in both the root dependency manifest and `server/package.json`. If the backend begins importing a workspace package, also update the runtime image to include that package and its dependencies; the existing frontend build does not make package runtime code available to Node automatically.

The checked-in Docker runtime install does not use the root pnpm lockfile. Account for this distinction when investigating dependency differences between local development and a production image.

`VITE_*` values are client build inputs. Backend values such as `DATABASE_URL`, `REQUIRE_AUTH`, and `TRUSTED_ORIGINS` are runtime configuration. See [Getting started](getting-started.md) and [Server](server.md).

## Documentation maintenance

When changing a contract, update these references:

| Change | Documentation |
| --- | --- |
| Shape/store/geometry export | [core.md](core.md) |
| React component props | [component reference](../packages/react/docs/components.md) and [react.md](react.md) |
| Hook or lifecycle | [hooks.md](hooks.md) |
| Connection/presence API | [sync.md](sync.md) |
| Route, preference, user-visible behavior | [application.md](application.md) |
| Endpoint, SQL, configuration, persistence | [server.md](server.md) and [getting-started.md](getting-started.md) |
| Package ownership or build changes | [architecture.md](architecture.md) and this guide |

The component playground has its own searchable reference data in [reference.ts](../examples/component-demo/src/reference.ts). Keep that data and the Markdown component reference aligned with public exports. The source viewer imports actual example files, so changing an example updates its displayed source.

Check repository-relative links, code fences, public export coverage, and examples against the implementation. Do not describe proposed packages or APIs as shipped behavior.

For commits, group related changes into reviewable iterations, use a short title, and describe the resulting behavior and validation in the body. Keep generated build output, local secrets, and unrelated formatting out of those commits.

