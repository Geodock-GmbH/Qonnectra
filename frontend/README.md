# Qonnectra Frontend

SvelteKit-based frontend application for the Qonnectra GIS system, providing an interactive map interface and infrastructure management tools.

## Overview

The frontend is built with SvelteKit 2 and Svelte 5, featuring OpenLayers for map visualization, Skeleton UI for components, and Svelte Flow for network schema editing.

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Development Server

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

Open in browser automatically:

```bash
npm run dev -- --open
```

### 3. Build for Production

```bash
npm run build
```

### 4. Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable Svelte components
│   │   ├── map/            # OpenLayers map utilities
│   │   ├── classes/        # JavaScript classes
│   │   ├── stores/         # Svelte stores for state management
│   │   └── utils/          # Utility functions
│   └── routes/             # SvelteKit routes (file-based routing)
│       ├── map/            # Map view routes
│       ├── trench/         # Trench management
│       ├── conduit/        # Conduit management
│       ├── node/           # Node management
│       ├── network-schema/ # Network schema editor
│       └── ...
├── static/                 # Static assets
└── messages/               # Translation files (i18n)
```

## Key Components

### Map Component

Located in `src/lib/components/Map.svelte`, provides:

- OpenLayers 10 map integration
- Layer visibility controls with tree structure
- Opacity slider for base layer
- Vector tile support with TileServer-GL integration (light/dark themes)
- Search panel for address/feature lookup
- Map state persistence (center, zoom)
- MVT (Mapbox Vector Tile) layer support
- Dynamic theme switching

### Layer Visibility Tree

Interactive layer management UI for toggling map layers on/off.

### Route Components

- **Map View** (`routes/map/`): Main map interface with layer management and vector tile support
- **Trench Management** (`routes/trench/`): Trench CRUD operations
- **Conduit Management** (`routes/conduit/`): Conduit management
- **Node Management** (`routes/node/`): Node management with slot configuration
- **Network Schema** (`routes/network-schema/`): Visual network diagram editor with Svelte Flow
- **Pipe Branch** (`routes/pipe-branch/`): Pipe branch visualization
- **House Connections** (`routes/house-connections/`): Address and connection management
- **Node Structure Panel**: Advanced node slot configuration and management
- **Fiber Splice Manager**: Visual fiber splice tracking and management
- **Container Management**: Container organization and tracking

## State Management

The application uses Svelte stores for state management:

- **Map State**: Map center, zoom level persistence
- **Authentication**: User session management
- **API Client**: Centralized API request handling

Stores are located in `src/lib/stores/`.

## Routing

SvelteKit uses file-based routing in the `src/routes/` directory:

- `+page.svelte` - Page component
- `+page.server.js` - Server-side data loading
- `+layout.svelte` - Layout component
- `+error.svelte` - Error page

Dynamic routes use brackets: `[id]` or `[[optionalId]]`

## Internationalization

The application supports multiple languages via [Paraglide](https://paraglide.dev/):

- German (`de`)
- English (`en`)

Translation files are in `messages/` and managed through Paraglide.

## Styling

- **TailwindCSS 4**: Utility-first CSS framework
- **Skeleton UI**: Component library for consistent design
- Custom styles in `src/app.css`

## Testing

### Unit Tests (Vitest)

```bash
npm run test:unit
```

Run specific test:

```bash
npm run test:unit -- --run src/routes/page.svelte.test.js
```

### End-to-End Tests (Playwright)

```bash
npx playwright test
```

Run specific E2E test:

```bash
npx playwright test tests/e2e/login.spec.js
```

View test report:

```bash
npx playwright show-report
```

## Code Formatting

Format code with Prettier:

```bash
npm run format
```

Check formatting:

```bash
npm run lint
```

## Key Dependencies

### Core

- **Svelte 5**: Reactive framework with runes
- **SvelteKit 2**: Full-stack framework
- **Vite**: Build tool and dev server

### Mapping

- **OpenLayers 10**: Interactive maps and spatial data visualization
- **ol-mapbox-style**: Mapbox style integration for vector tiles

### UI Components

- **Skeleton UI**: Component library
- **Tabler Icons**: Icon library

### Visualization

- **Svelte Flow**: Network diagram visualization and interactive node/edge editing
- **Perfect Freehand**: Hand-drawn path rendering
- **Chart.js**: Data visualization and charting

### Internationalization

- **Paraglide**: Type-safe i18n

## API Integration

The frontend communicates with the Django REST API. API calls are handled through:

- Utility functions in `src/lib/utils/`
- Server-side data loading in `+page.server.js` files
- API endpoints configured via environment variables

## Environment Variables

The frontend uses environment variables (typically set via `.env` or deployment configuration):

- `API_URL`: Backend API URL
- `ORIGIN`: Frontend origin for CORS

## Additional Resources

- [Main README](../README.md)
- [Backend README](../backend/README.md)
- [Deployment Guide](../deployment/README.md)
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Svelte 5 Documentation](https://svelte.dev/docs)
- [OpenLayers Documentation](https://openlayers.org/)
- [Skeleton UI Documentation](https://www.skeleton.dev/)
