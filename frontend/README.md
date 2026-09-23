## Qonnectra Frontend

SvelteKit frontend for the Qonnectra GIS system: the interactive map and the tools for managing the infrastructure data.

### Overview

The frontend is built with SvelteKit 2, Svelte 5 runes and TypeScript, using:

- OpenLayers 10 for the map
- Skeleton UI 5 for components
- TailwindCSS 4 for styling
- Svelte Flow (via `@xyflow/svelte`) for network schema editing
- Paraglide for type-safe internationalization
- SvelteKit remote functions (`query` / `command` / `form`) with valibot schemas for talking to the Django API

The main project README (`../README.md`) gives a system-wide overview. The domain vocabulary used below (current project, remembered project, feature, drawer, map view, place vs. adjustment) is defined in `../CONTEXT.md`.

## Prerequisites

- Node.js 22+ (LTS recommended)
- npm (bundled with Node.js)

You can use other package managers (pnpm, yarn), but this README assumes `npm`.

## Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and adjust values as needed:

```bash
cp .env.example .env
```

The variables are listed under Environment variables below.

### 3. Development server

Start the dev server:

```bash
npm run dev
```

The application is available at `http://localhost:5173`.

### 4. Build for production

```bash
npm run build
```

### 5. Preview production build

```bash
npm run preview
```

## Project structure

```text
frontend/
├── messages/                 # Paraglide translation files (de.json, en.json)
├── project.inlang/           # Paraglide project configuration
├── src/
│   ├── app.css               # Tailwind/Skeleton/global styles
│   ├── app.d.ts              # App-wide types (Locals, PageData, ...)
│   ├── app.html
│   ├── hooks.ts              # Universal hooks (Paraglide reroute)
│   ├── hooks.client.ts       # Client hooks (reports uncaught errors to the backend log)
│   ├── hooks.server.ts       # Server hooks: i18n, authentication, route permissions
│   ├── service-worker.ts
│   ├── params/               # Route param matchers (integer, traceEntryType)
│   ├── lib/
│   │   ├── classes/          # Class-based state managers (*.svelte.ts)
│   │   ├── components/       # Reusable Svelte components
│   │   ├── config/           # Navigation links and route-id registry
│   │   ├── context/          # Typed contexts: current project, remembered project, network schema
│   │   ├── map/              # OpenLayers layers, styles, tile loading, MVT worker, map-view hash
│   │   ├── remote/           # Remote functions, one folder per domain
│   │   ├── server/           # Server-only helpers: session cache, token refresh, reference data
│   │   ├── stores/           # Svelte stores for persisted UI preferences
│   │   ├── test-utils/       # Vitest fixtures, stubs and mocks
│   │   ├── types/            # Shared types, incl. generated api.d.ts
│   │   └── utils/            # Shared utilities (URL state, auth headers, logging, ...)
│   └── routes/               # SvelteKit file-based routing (see below)
├── static/                   # Static assets (favicon, logo, etc.)
├── tests/e2e/                # Playwright E2E tests
├── vite.config.ts            # Vite + SvelteKit + Paraglide + Tailwind + Vitest
├── playwright.config.js      # Playwright configuration
├── eslint.config.js
└── package.json
```

Route-specific components live next to their route in a `components/` folder (e.g. `routes/project/[projectId=integer]/map/components/`). Only components used by several routes belong in `src/lib/components/`.

## Routing

### URLs

The URL is the source of truth for where the user is and what they are looking at (see `../docs/adr/0001-url-is-source-of-truth-for-current-project.md`):

- Path: the project and detail pages (`/project/5/address/<uuid>`)
- Query: the open drawer feature (`?feature=trench:<uuid>`), tab, search, pagination
- Hash: the map view (`#map=<zoom>/<x>/<y>`, EPSG:3857)

Opening a place (a drawer, another feature) pushes a history entry; adjustments (tabs, search, map moves) replace the current one. The helpers for this live in `src/lib/utils/urlState.ts` (`setQuery`, `openFeature`, `closeFeature`, `queryInt`, ...).

Build URLs with the typed `resolve()` from `$app/paths`, never with template literals, and read state from `page.params` / `page.url` / `page.route.id` instead of parsing `pathname`. Route ids are collected in `src/lib/config/routes.ts`.

### Routes overview

Project-scoped pages live under `/project/[projectId=integer]/`. The project layout validates the id against the user's projects; `/project/<id>` redirects to the project's map.

| Route                                      | Purpose                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `project/[projectId]/map`                  | Main GIS map: layer tree, search, drawer, measuring, trench profile             |
| `project/[projectId]/dashboard/[[flagId]]` | Project statistics, charts and tables                                           |
| `project/[projectId]/trench/[[flagId]]`    | Trench-conduit connections                                                      |
| `project/[projectId]/conduit`              | Conduit management, Excel import/export                                         |
| `project/[projectId]/house-connections`    | Microducts and house connections                                                |
| `project/[projectId]/address/...`          | Addresses and residential units (`[uuid]`, `unit/[unitUuid]`)                   |
| `project/[projectId]/network-schema`       | Svelte Flow network schema; `node/[nodeId]` for one node's view                 |
| `project/[projectId]/pipe-branch`          | Pipe branch editing; `node/[nodeUuid]` for one node                             |
| `project/[projectId]/fault-simulation`     | Fault simulation                                                                |
| `project/[projectId]/post-compaction`      | Post-compaction                                                                 |
| `project/[projectId]/valuation`            | Network valuation                                                               |
| `trace/[entryType]/[uuid]`                 | Fiber trace and signal analysis (address, cable, fiber, node, residential unit) |
| `pipeline-records/...`                     | Pipeline records and inquiries (global, not project-scoped)                     |
| `settings`                                 | User settings and map styles                                                    |
| `admin/logs`                               | Log viewer                                                                      |
| `login`                                    | Login                                                                           |

Old URL shapes without the `/project/<id>` prefix (`/map`, `/map/5`) are 404s.

### Authentication and permissions

`src/hooks.server.ts` is the single auth gate (`handleAuth`). It:

- Resolves the session from the JWT cookies, cached per access token for 30 s (`src/lib/server/session.ts`) and refreshed when needed (`src/lib/server/tokenRefresh.ts`)
- Authorises each route by its **permission key**: the route id with the project prefix and parameters stripped (`permissionKeyFor` in `src/lib/config/routes.ts`)
- Redirects unauthenticated users to `/login?redirectTo=…`, and sends `/`, `/login` (when logged in) and denied routes to the **landing page**: the map of the remembered project, or of the user's first project

On the client, `src/lib/utils/sessionKeepAlive.ts` keeps the session fresh while the user is logged in.

The **remembered project** is a `last-project` cookie (`src/lib/utils/rememberedProject.ts`). It survives logout and only picks the landing project and the default on global pages; it never decides what a project URL shows.

## Data loading and API integration

The frontend talks to the Django REST API through **remote functions** in `src/lib/remote/<domain>/`:

- `*.remote.ts`: `query` / `command` / `form` functions that call the backend server-side, with valibot argument schemas
- plain `*.ts` siblings: pure helpers (response mapping, fetch orchestration) with their own unit tests
- `shared/`: auth headers for remote calls, backend error mapping (`failFromResponse`, `remoteErrorMessage`), attribute options

Components call queries directly and render them inside `QueryBoundary.svelte`. Errors must be thrown as SvelteKit `HttpError`s (`error()` / `failFromResponse()`); a plain `Error` reaches the client as "Internal Error".

The few remaining load functions:

- `src/routes/+layout.server.ts`: user, projects, flags, app version and remembered project (reruns only when `app:reference-data` is invalidated)
- `src/routes/project/[projectId=integer]/+layout.ts`: validates the project id
- `network-schema/+page.server.ts`, `admin/logs/+page.server.ts`
- `conduit/download/+server.ts`: Excel download endpoint

The API types in `src/lib/types/api.d.ts` are generated from the backend's OpenAPI schema:

```bash
npm run generate:types   # reads ../backend/schema.yml
```

## State management

### Class-based managers (`src/lib/classes/`)

Larger flows are modelled as classes in `*.svelte.ts` files and shared via context instead of prop drilling:

- Map: `MapState`, `MapInteractionManager`, `MapSelectionManager`, `MapPopupManager`, `MapMeasureManager`
- Network schema and node structure: `NetworkSchemaState`, `NetworkSchemaSearchManager`, `NodeStructureManager`, `NodeStructureContext`
- Fiber and cable data: `FiberSpliceManager`, `CableFiberDataManager`, `CableMicropipeManager`
- Other: `AddressState`, `DragDropManager`, `InquiryDrawManager`, `PanelResizeManager`

`NetworkSchemaState` owns all edge, label, path and shift state of the schema; see `src/lib/context/networkSchemaContext.ts` for its typed context.

### Contexts (`src/lib/context/`)

- `project.ts`: `routeProjectId()` and `onProjectChange()` for the current project, derived from the URL
- `rememberedProject.svelte.ts`: reactive wrapper around the `last-project` cookie
- `networkSchemaContext.ts`: `getSchemaState` / `setSchemaState`

### Stores (`src/lib/stores/`)

Stores hold personal preferences, not navigation state:

- `store.ts`: persisted UI preferences (sidebar, theme, drawer size, layer visibility and opacity, map styles, network schema display options, WMS layer state)
- `sidebarPreferences.ts`: hidden routes and collapsed groups in the sidebar
- `auth.ts`: `userStore` and `updateUserStore()`
- `toaster.ts`: `globalToaster` for Skeleton's `<Toast.Group>`
- `persisted.ts` / `session.ts`: `writable` stores synced to `localStorage` / `sessionStorage` (no-ops on the server)

User settings are also synced to the backend (`src/lib/utils/userSettingsSync.ts`).

## Map

The map lives in `src/lib/components/Map.svelte` and `src/routes/project/[projectId=integer]/map/`.

- Layer definitions, styles and tile sources are in `src/lib/map/`
- MVT vector tiles come from the backend and are parsed in a web worker pool (`mvtParserWorker.ts`, `workerPool.ts`, `tileLoadingManager.ts`)
- Base maps come from TileServer-GL (`PUBLIC_TILE_SERVER_URL`), with OSM tiles as the fallback when it is unset
- WMS layers are configured in the Django admin
- The map view is kept in the URL hash (`viewHash.ts`) and remembered per project (`storedView.ts`)
- The open feature is kept in the `feature` query parameter (`urlFeatureSelection.ts`)

## Internationalization

Internationalization uses Paraglide:

- Configuration: `project.inlang/settings.json`
- Generated runtime: `src/lib/paraglide`
- Message files: `messages/de.json`, `messages/en.json`
- Type-safe message access via the `m` helper, e.g. `m.nav_dashboard()`
- Locale strategy: `localStorage` + `baseLocale` (configured in `vite.config.ts`), so URLs carry no locale prefix
- Locales: German (`de`) and English (`en`)

When editing `de.json` and `en.json`, keep the keys sorted alphabetically (ascending). The VS Code task "Sort i18n JSON Files" sorts them for you.

## Styling

Styling uses:

- TailwindCSS 4 (`@tailwindcss/vite`)
- Skeleton UI 5 (`@skeletonlabs/skeleton`, `@skeletonlabs/skeleton-svelte`)
- `src/app.css`, which:
  - Imports the Tailwind and Skeleton layers
  - Configures the legacy Skeleton theme via `[data-theme='legacy']`
  - Defines toast color variants and global behaviors

Dark mode is controlled via data attributes (e.g. `data-mode="dark"`), and the chosen mode is stored in a persisted store.

## Testing

### Unit and component tests (Vitest)

`vite.config.ts` configures two Vitest projects:

- `client`: `jsdom`, includes `src/**/*.svelte.{test,spec}.{js,ts}`, uses `@testing-library/svelte` and `vitest-setup-client.js`
- `server`: `node`, includes all other `src/**/*.{test,spec}.{js,ts}`

```bash
npm test                  # run all unit tests once
npm run test:unit         # watch mode
npm run test:unit -- --run src/lib/utils/urlState.test.ts   # single file
npm run test:coverage     # with v8 coverage
```

Shared fixtures, stubs and mocks live in `src/lib/test-utils/` (e.g. `Boundary.fixture.svelte` for components that await queries, `remote-stubs.ts` for remote functions).

### End-to-end tests (Playwright)

Playwright is configured in `playwright.config.js`:

- Test directory: `tests/`
- Browsers: Chromium, Firefox, WebKit
- Base URL: `http://localhost:5173`; the dev server is started automatically unless one is already running
- Credentials: set `E2E_TEST_USERNAME` and `E2E_TEST_PASSWORD` in `.env` (without them the authenticated specs skip)

```bash
npx playwright test                            # all specs
npx playwright test tests/e2e/login.spec.js    # single spec
npx playwright show-report                     # latest HTML report
```

WebKit drops `Secure` cookies over plain HTTP, so logins fail there against the local HTTP dev server; Chromium and Firefox are unaffected.

## Code quality

```bash
npm run check     # Paraglide compile + svelte-kit sync + svelte-check
npm run lint:ts   # ESLint (TypeScript + Svelte)
npm run format    # Prettier write
npm run lint      # Prettier check
```

Prettier uses `prettier-plugin-svelte` and `@ianvs/prettier-plugin-sort-imports`.

## Dependencies

`package.json` has the exact versions. The main libraries:

- Svelte 5, SvelteKit 2 and Vite 8
- OpenLayers (`ol`) and ol-mapbox-style: maps and vector tiles
- proj4: coordinate system transformations (ETRS89 / UTM)
- Skeleton UI (`@skeletonlabs/skeleton`, `@skeletonlabs/skeleton-svelte`)
- Tabler Icons (`@tabler/icons-svelte`)
- Svelte Flow (`@xyflow/svelte`): network diagrams
- Chart.js: charts and statistics
- valibot: remote function argument validation
- jsPDF: PDF export
- Fuse.js: fuzzy search
- Paraglide (`@inlang/paraglide-js`): internationalization
- Vitest, Testing Library and Playwright: unit, component and E2E tests

## Environment variables

Environment variables are defined in `.env` (see `.env.example`):

| Variable                   | Required | Description                                                         | Example                         |
| -------------------------- | -------- | ------------------------------------------------------------------- | ------------------------------- |
| `API_URL`                  | Yes      | Backend API URL used server-side                                    | `http://localhost:8000/api/v1/` |
| `PUBLIC_API_URL`           | Yes      | Backend API URL reachable from the browser                          | `http://localhost:8000/api/v1/` |
| `PUBLIC_TILE_SERVER_URL`   | No       | Vector tile server; omit to fall back to OSM tiles                  | `https://tiles.localhost`       |
| `PUBLIC_DOCUMENTATION_URL` | No       | Link to the user manual in the sidebar and app bar                  | `https://qonnectra.de/manual/`  |
| `ORIGIN`                   | No       | Public origin of the app (needed by the Node adapter in production) | `https://app.localhost`         |
| `E2E_TEST_USERNAME`        | No       | Playwright login user                                               |                                 |
| `E2E_TEST_PASSWORD`        | No       | Playwright login password                                           |                                 |

In the Docker deployment these variables come from `deployment/.env`.

## Additional resources

- Main project: `../README.md`
- Backend: `../backend/README.md`
- Deployment: `../deployment/README.md`
- Domain glossary: `../CONTEXT.md`
- Svelte and SvelteKit docs: `https://svelte.dev/docs`
- OpenLayers docs: `https://openlayers.org/`
- Skeleton UI docs: `https://www.skeleton.dev/`
- Svelte Flow docs: `https://svelteflow.dev/api-reference`
- Paraglide docs: `https://paraglide.dev/`
