## Qonnectra Frontend

SvelteKit-based frontend application for the Qonnectra GIS system, providing an interactive map interface and infrastructure management tools.

**Version**: 0.7.0 (from `package.json`)

### Overview

The frontend is built with **SvelteKit 2** and **Svelte 5 runes**, using:

- **OpenLayers 10.5** for map visualization
- **Skeleton UI** for components
- **TailwindCSS 4** for styling
- **Svelte Flow** (via `@xyflow/svelte`) for network schema editing
- **Paraglide** for type-safe internationalization

For a system-wide overview, see the main project README: `../README.md`.

---

## Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm** (bundled with Node.js)

You can use other package managers (pnpm, yarn), but this README assumes `npm`.

---

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

Key variables are documented in the **Environment variables** section below.

### 3. Development server

Start the dev server (do this from your own terminal, not via AI tools):

```bash
npm run dev
```

The application is available at `http://localhost:5173`.

Open in browser automatically:

```bash
npm run dev -- --open
```

### 4. Build for production

```bash
npm run build
```

### 5. Preview production build

```bash
npm run preview
```

---

## Project structure

```text
frontend/
├── messages/                 # Paraglide translation files (i18n)
│   ├── de.json
│   └── en.json
├── project.inlang/           # Paraglide project configuration
├── src/
│   ├── app.css               # Tailwind/Skeleton/global styles
│   ├── app.html
│   ├── hooks.js              # Client hooks
│   ├── hooks.server.js       # Server hooks (auth, public routes, etc.)
│   ├── lib/
│   │   ├── classes/          # Class-based state managers (Svelte 5 friendly)
│   │   │   ├── AddressState.svelte.js
│   │   │   ├── ConduitState.svelte.js
│   │   │   ├── MapState.svelte.js
│   │   │   ├── MapInteractionManager.svelte.js
│   │   │   ├── MapSelectionManager.svelte.js
│   │   │   ├── MapPopupManager.svelte.js
│   │   │   ├── NetworkSchemaState.svelte.js
│   │   │   ├── NetworkSchemaSearchManager.svelte.js
│   │   │   ├── NodeStructureManager.svelte.js
│   │   │   ├── NodeStructureContext.svelte.js
│   │   │   ├── FiberSpliceManager.svelte.js
│   │   │   ├── CableFiberDataManager.svelte.js
│   │   │   ├── CablePathManager.svelte.js
│   │   │   ├── DragDropManager.svelte.js
│   │   │   └── NodeAssignmentManager.svelte.js
│   │   ├── components/       # Reusable Svelte components
│   │   │   ├── AppBar.svelte
│   │   │   ├── LayerVisibilityTree.svelte
│   │   │   ├── Map.svelte
│   │   │   ├── MobileNav.svelte
│   │   │   ├── Drawer.svelte
│   │   │   ├── SearchPanel.svelte
│   │   │   ├── TrenchStatistics.svelte
│   │   │   └── ...
│   │   ├── map/              # OpenLayers map utilities
│   │   │   ├── layers.js
│   │   │   ├── styles.js
│   │   │   ├── searchUtils.js
│   │   │   └── tileSources.js
│   │   ├── server/           # Server-side utilities (used from +page.server.js, +server.js)
│   │   │   ├── attributes.js
│   │   │   ├── conduitData.js
│   │   │   └── featureSearch.js
│   │   ├── stores/           # Svelte stores for state management
│   │   │   ├── auth.js
│   │   │   ├── drawer.js
│   │   │   ├── persisted.js
│   │   │   ├── session.js
│   │   │   ├── store.js
│   │   │   └── toaster.js
│   │   └── utils/            # Shared utilities
│   │       ├── contentTypes.js
│   │       ├── edgeGeometry.js
│   │       ├── featureUtils.js
│   │       ├── fieldAliases.js
│   │       ├── getAuthHeaders.js
│   │       ├── logToBackendClient.js
│   │       ├── logToBackendServer.js
│   │       ├── svelteFlowLock.js
│   │       ├── tooltip.js
│   │       └── zoomToLayerExtent.js
│   └── routes/               # SvelteKit file-based routing
│       ├── +layout.svelte
│       ├── +layout.server.js
│       ├── +error.svelte
│       ├── login/
│       │   ├── +page.server.js
│       │   └── +page.svelte
│       ├── logout/
│       │   └── +server.js
│       ├── dashboard/
│       │   └── [[projectId]]/[[flagId]]/
│       │       ├── +page.server.js
│       │       └── +page.svelte
│       ├── map/
│       │   └── [[projectId]]/
│       │       ├── +page.js
│       │       ├── +page.server.js
│       │       ├── +page.svelte
│       │       └── MapDrawerTabs.svelte
│       ├── trench/
│       │   └── [[projectId]]/[[flagId]]/
│       │       ├── +page.server.js
│       │       ├── +page.svelte
│       │       └── TrenchTable.svelte
│       ├── conduit/
│       │   ├── [[projectId]]/
│       │   │   ├── +page.server.js
│       │   │   ├── +page.svelte
│       │   │   ├── ConduitDrawerTabs.svelte
│       │   │   └── PipeTable.svelte
│       │   └── download/
│       │       └── +server.js
│       ├── house-connections/
│       │   └── [[projectId]]/
│       │       ├── +page.js
│       │       ├── +page.server.js
│       │       ├── +page.svelte
│       │       └── HouseConnectionDrawerTabs.svelte
│       ├── address/
│       │   └── [projectId]/
│       │       ├── +page.server.js
│       │       ├── +page.svelte
│       │       └── [uuid]/
│       │           ├── +page.server.js
│       │           ├── +page.svelte
│       │           └── unit/
│       │               └── [unitUuid]/
│       │                   ├── +page.server.js
│       │                   └── +page.svelte
│       ├── network-schema/
│       │   └── [[projectId]]/
│       │       ├── +page.server.js
│       │       ├── +page.svelte
│       │       └── (supporting schema components ...)
│       ├── pipe-branch/
│       │   └── [[projectId]]/
│       │       ├── +page.server.js
│       │       ├── +page.svelte
│       │       └── (lasso & node components ...)
│       ├── settings/
│       │   ├── +page.server.js
│       │   └── +page.svelte
│       └── admin/
│           └── logs/
│               ├── +page.server.js
│               └── +page.svelte
├── static/                   # Static assets (favicon, logo, etc.)
├── tests/                    # Playwright E2E tests
│   └── e2e/
│       ├── login.spec.js
│       ├── routing.spec.js
│       └── canvas-sync-*.spec.js
├── vite.config.js            # Vite + SvelteKit + Paraglide + Tailwind
├── playwright.config.js      # Playwright configuration
└── package.json
```

---

## Key concepts and architecture

### Root layout and navigation

- `src/routes/+layout.svelte` defines the main shell:
  - Persistent **sidebar**, **app bar**, and **mobile navigation**
  - Global **loading overlay** and **toast** system
  - Theme handling via a `theme` store and `data-theme` attribute
- `src/routes/+layout.server.js`:
  - Enforces authentication for protected routes (redirects unauthenticated users to `/login`)
  - Loads global data such as **projects**, **flags**, and **app version** (from `package.json`)

### Routes overview

- `login/` – Authentication flow (login form, redirect handling)
- `dashboard/[[projectId]]/[[flagId]]/` – Project dashboard with:
  - Statistics cards (`TrenchStatistics.svelte`, project tables, warranty overview)
  - Tabs for overview, trench data, and project listings
- `map/[[projectId]]/` – Main GIS map interface:
  - OpenLayers map (`Map.svelte`)
  - Layer tree, search panel, selection drawers
  - Map interaction, popup, and selection managers
- `trench/[[projectId]]/[[flagId]]/` – Trench management (tables, filters, flags)
- `conduit/[[projectId]]/` – Conduit and pipe management:
  - File upload, search, drawers, and attribute cards
- `house-connections/[[projectId]]/` – House connection management:
  - Connections, microducts, address linkage
- `address/[projectId]/...` – Address and residential unit management:
  - Address table, unit detail pages, and nested unit routes
- `network-schema/[[projectId]]/` – Network schema editor:
  - Svelte Flow-based network graph
  - Node/edge attribute cards, fiber panels, slot configuration
- `pipe-branch/[[projectId]]/` – Pipe branch visualization and editing (lasso selection, trench selector)
- `settings/` – Application and user-level settings
- `admin/logs/` – Administrative log viewer

Route files follow standard SvelteKit conventions:

- `+page.svelte` – Page UI
- `+page.server.js` – Server-side data loading
- `+page.js` – Client-side load when needed
- `+server.js` – API-like endpoints

Dynamic routes use:

- Required params: `[projectId]`, `[uuid]`, `[unitUuid]`
- Optional params: `[[projectId]]`, `[[flagId]]`

### Map and GIS components

The core map interface is implemented in:

- `src/lib/components/Map.svelte`
- `src/routes/map/[[projectId]]/+page.svelte`

Key features:

- OpenLayers 10.5 integration with reusable layer definitions from `src/lib/map/`
- **Layer visibility tree**, **opacity slider**, and base map switching
- **MVT** (Mapbox Vector Tile) support via `ol-mapbox-style`
- **Search panel** for address and feature lookup
- Map state persistence (center, zoom, selected project)
- Project-aware style configuration (trench colors, node styles, label visibility)
- Drawer-based feature details (`Drawer.svelte`, map drawer tabs)

Map behavior is managed by class-based state managers (in `src/lib/classes/`):

- `MapState` – base map setup, layer configuration, and persistence
- `MapSelectionManager` – selection logic
- `MapPopupManager` – feature popups and overlays
- `MapInteractionManager` – wiring of interactions, drawers, and side panels

### Network schema editor

The network schema editor lives under `src/routes/network-schema/[[projectId]]/` and uses Svelte Flow (`@xyflow/svelte`) to visualize and edit:

- **Nodes** and **edges** (`CableDiagramNode.svelte`, `CableDiagramEdge.svelte`)
- **Fibers** and **ports** (`FiberCell.svelte`, `PortTable.svelte`, `CableFiberSidebar.svelte`)
- **Node structure** (`NodeStructurePanel.svelte`, `SlotGrid.svelte`, `SlotConfigItem.svelte`)
- **Containers** and component types (`ContainerItem.svelte`, `ComponentTypeSidebar.svelte`)

State and orchestration are handled by:

- `NetworkSchemaState.svelte.js`
- `NetworkSchemaSearchManager.svelte.js`
- `NodeStructureManager.svelte.js`
- `NodeStructureContext.svelte.js`
- `FiberSpliceManager.svelte.js`
- `CableFiberDataManager.svelte.js`
- `CablePathManager.svelte.js`

These classes encapsulate complex behavior and avoid prop drilling by combining with `setContext`/`getContext`.

---

## State management

State is primarily handled via **Svelte stores** and **class-based managers**.

### Stores (`src/lib/stores/`)

- `auth.js`
  - `userStore` – authentication state (isAuthenticated, username, roles)
  - Helper `updateUserStore()` used from the root layout
- `store.js`
  - Layout and map-related stores, e.g.:
    - `sidebarExpanded` – persisted sidebar state
    - `selectedProject` – currently active project
    - `mapCenter`, `mapZoom` – persisted map view
- `drawer.js`
  - `drawerStore` – central drawer state (open/close, content)
- `toaster.js`
  - `globalToaster` – shared toast manager used with Skeleton’s `<Toast.Group>`
- `persisted.js`
  - `persisted(key, initial)` – helper creating a `writable` store synchronized to `localStorage`
- `session.js`
  - `session(key, initial)` – helper creating a `writable` store synchronized to `sessionStorage`

These helpers abstract browser storage access and are safe on the server (they no-op when `browser === false`).

### Class-based managers (`src/lib/classes/`)

Instead of deeply nested props, complex flows are modeled as classes and passed via Svelte’s context:

- Map-related classes (`MapState`, `MapInteractionManager`, `MapSelectionManager`, `MapPopupManager`)
- Conduit/pipe classes (`ConduitState`, `ConduitDataManager`)
- Address management (`AddressState`)
- Network schema and node structure (`NetworkSchemaState`, `NetworkSchemaSearchManager`, `NodeStructureManager`, `NodeStructureContext`)
- Fiber and cable data (`FiberSpliceManager`, `CableFiberDataManager`, `CablePathManager`)
- Utility managers (`DragDropManager`, `NodeAssignmentManager`)

They are typically constructed in `+page.svelte` files and exposed via:

```js
import { setContext } from 'svelte';

setContext('mapManagers', {
  mapState,
  selectionManager,
  popupManager,
  interactionManager
});
```

Downstream components then use `getContext` instead of prop drilling.

---

## Routing and data loading

The app uses standard SvelteKit patterns:

- **Server load**: `+page.server.js` files fetch data from the Django REST API and return typed `PageData`.
- **Client load**: a few routes use `+page.js` for client-side navigation concerns.
- **API routes**: `+server.js` files (e.g. `conduit/download/+server.js`) provide HTTP endpoints.
- **Global auth**: `src/routes/+layout.server.js` checks the user from `locals` and redirects unauthenticated access to non-public routes.

Environment-aware behavior (e.g. base URLs) is configured via `.env` and SvelteKit’s env handling.

---

## Internationalization

Internationalization is powered by **Paraglide**:

- Configuration: `project.inlang/settings.json`
- Generated runtime: `src/lib/paraglide`
- Message files: `messages/de.json`, `messages/en.json`

Key characteristics:

- **Type-safe** message access via the `m` helper, e.g. `m.nav_dashboard()`
- Locale strategy: `localStorage` + `baseLocale` (configured in `vite.config.js`)
- Locales:
  - German (`de`)
  - English (`en`)

When editing `de.json` and `en.json`, keep keys **alphabetically sorted (ASC)**.

---

## Styling

Styling is handled by:

- **TailwindCSS 4** (`@tailwindcss/vite`, `tailwindcss@^4.0.0`)
- **Skeleton UI 4.11** (`@skeletonlabs/skeleton`, `@skeletonlabs/skeleton-svelte`)
- `src/app.css`:
  - Imports Tailwind and Skeleton layers
  - Configures the **legacy** Skeleton theme via `[data-theme='legacy']`
  - Defines toast color variants and global behaviors

Dark mode is controlled via data attributes (e.g. `data-mode="dark"`), and theme selection is stored in a Svelte store so it persists across sessions.

---

## Testing

### Unit and integration tests (Vitest)

Tests are configured in `vite.config.js` using **Vitest workspaces**:

- **Client workspace**:
  - Environment: `jsdom`
  - Includes: `src/**/*.svelte.{test,spec}.{js,ts}`
  - Uses `@testing-library/svelte`, `@testing-library/jest-dom`, and `vitest-setup-client.js`
- **Server workspace**:
  - Environment: `node`
  - Includes: `src/**/*.{test,spec}.{js,ts}`
  - Excludes Svelte component tests (handled by the client workspace)

Run all unit tests:

```bash
npm run test:unit
```

Run a specific test file:

```bash
npm run test:unit -- --run src/routes/network-schema/[[projectId]]/page.svelte.test.js
```

`npm run test` is a convenience alias that runs `npm run test:unit -- --run`.

### End-to-end tests (Playwright)

Playwright is configured in `playwright.config.js`:

- Test directory: `tests/`
- Browsers: Chromium, Firefox, WebKit
- Base URL: `http://localhost:5173`
- Dev server:
  - `command: 'npm run dev'`
  - `reuseExistingServer: !process.env.CI`

Run all E2E tests:

```bash
npx playwright test
```

Run a specific E2E spec:

```bash
npx playwright test tests/e2e/login.spec.js
```

Show the latest HTML report:

```bash
npx playwright show-report
```

---

## Code quality and formatting

Formatting and linting are handled via **Prettier**:

- `npm run format` – format all files (`prettier --write .`)
- `npm run lint` – check formatting (`prettier --check .`)

Relevant dev dependencies:

- `prettier`
- `prettier-plugin-svelte`
- `@ianvs/prettier-plugin-sort-imports`

---

## Key dependencies

Versions below are taken from `package.json` and may evolve over time.

### Core

- **Svelte**: `^5.48.2`
- **SvelteKit**: `^2.50.1`
- **Vite**: `^6.2.5`

### Mapping

- **OpenLayers**: `ol@^10.5.0`
- **ol-mapbox-style**: `^13.2.0` – Mapbox style integration and MVT support
- **proj4**: `^2.20.2` – Coordinate system transformations (e.g. ETRS89 / UTM)

### UI and components

- **Skeleton UI**: `@skeletonlabs/skeleton@^4.11.0`, `@skeletonlabs/skeleton-svelte@^4.11.0`
- **Tabler Icons**: `@tabler/icons-svelte@^3.31.0`

### Visualization and diagrams

- **Svelte Flow**: `@xyflow/svelte@^1.2.4`
- **Chart.js**: `^4.5.1`
- **perfect-freehand**: `^1.2.2`

### Internationalization

- **Paraglide**: `@inlang/paraglide-js@^2.0.0`

### Other notable runtime dependencies

- `set-cookie-parser` – helper for parsing cookies

### Dev and testing

- `vitest`, `@playwright/test`
- `@testing-library/svelte`, `@testing-library/jest-dom`, `@testing-library/user-event`
- `@types/node`

---

## API integration

The frontend communicates with the Django REST API using:

- **Server-side utilities** in `src/lib/server/`:
  - `attributes.js` – loads attribute options (statuses, conduit types, etc.)
  - `conduitData.js` – conduit and pipe-related data loading
  - `featureSearch.js` – search APIs for features/addresses
- **Utility functions** in `src/lib/utils/`:
  - `getAuthHeaders.js` – constructs authenticated headers from cookies/session
  - `logToBackendClient.js` / `logToBackendServer.js` – logging helpers
  - `featureUtils.js`, `fieldAliases.js`, `zoomToLayerExtent.js`, etc.
- **Route load functions**:
  - `+page.server.js` files orchestrate calls to the backend and assemble `PageData`
  - `+server.js` files implement custom endpoints (e.g. conduit downloads)

Authentication is handled by the backend (JWT in HTTP-only cookies). The frontend reads auth state via layout `load` functions and syncs it into the `userStore`.

---

## Environment variables

Environment variables are defined in `.env` (see `.env.example` for a reference).

From `.env.example`:

- **`API_URL`**
  - Example: `http://localhost:8000/api/v1/`
  - Used server-side as the base URL for API calls.
- **`PUBLIC_API_URL`**
  - Example: `http://localhost:8000/api/v1/`
  - Public (client-side) base URL for API requests.
- **`PUBLIC_TILE_SERVER_URL`** (optional)
  - Example for local vector tiles: `http://localhost:8090`
  - Example for production: `https://tiles.geodock.de`
  - When omitted or commented out, the frontend falls back to standard OSM tiles for local development.

Alternative commented configurations in `.env.example` show how to target Docker containers (e.g. `http://backend:8000/api/v1/`) or production tile servers.

---

## Additional resources

- **Main project**: `../README.md`
- **Backend**: `../backend/README.md`
- **Deployment**: `../deployment/README.md`
- **Svelte & SvelteKit docs**: `https://svelte.dev/` and `https://kit.svelte.dev/`
- **OpenLayers docs**: `https://openlayers.org/`
- **Skeleton UI docs**: `https://www.skeleton.dev/`
- **Svelte Flow docs**: `https://svelteflow.dev/api-reference`
- **Paraglide docs**: `https://paraglide.dev/`

