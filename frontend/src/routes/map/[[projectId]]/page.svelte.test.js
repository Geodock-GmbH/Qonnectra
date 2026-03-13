import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';

vi.mock('$lib/paraglide/messages', () => {
	const mockMessages = new Proxy(
		{},
		{
			get: (target, prop) => {
				/** @type {Record<string, string>} */
				const messageMap = {
					nav_map: 'Map',
					title_error_loading_map_features: 'Error loading map features',
					message_error_could_not_load_map_tiles: 'Could not load map tiles'
				};
				return () => messageMap[/** @type {string} */ (prop)] || String(prop);
			}
		}
	);
	return { m: mockMessages };
});

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_TILE_SERVER_URL: '' }
}));

vi.mock('$lib/utils/tokenHeartbeat.svelte.js', () => ({
	startHeartbeat: vi.fn(),
	stopHeartbeat: vi.fn()
}));

vi.mock('ol/ol.css', () => ({}));

vi.mock('$lib/stores/drawer', () => ({
	drawerStore: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({ open: false });
			return () => {};
		},
		open: vi.fn()
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn()
	}
}));

vi.mock('$lib/stores/store', () => ({
	selectedProject: {
		subscribe: (/** @type {Function} */ cb) => {
			cb('proj-1');
			return () => {};
		}
	},
	globalMapView: {
		subscribe: (/** @type {Function} */ cb) => {
			cb(false);
			return () => {};
		}
	},
	nodeTypeStyles: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({});
			return () => {};
		}
	},
	trenchStyleMode: {
		subscribe: (/** @type {Function} */ cb) => {
			cb('default');
			return () => {};
		}
	},
	trenchSurfaceStyles: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({});
			return () => {};
		}
	},
	trenchConstructionTypeStyles: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({});
			return () => {};
		}
	},
	trenchColor: {
		subscribe: (/** @type {Function} */ cb) => {
			cb('#000000');
			return () => {};
		}
	},
	trenchColorSelected: {
		subscribe: (/** @type {Function} */ cb) => {
			cb('#ff0000');
			return () => {};
		}
	},
	addressStyle: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({ color: '#0000ff', size: 6 });
			return () => {};
		}
	},
	areaTypeStyles: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({});
			return () => {};
		}
	},
	labelVisibilityConfig: {
		subscribe: (/** @type {Function} */ cb) => {
			cb({});
			return () => {};
		}
	}
}));

vi.mock('$lib/components/Map.svelte', async () => {
	const { default: MockMap } = await import('$lib/test-utils/mocks/MockMap.svelte');
	return { default: MockMap };
});

vi.mock('$lib/components/Drawer.svelte', async () => {
	const { default: MockDrawer } = await import('$lib/test-utils/mocks/MockDrawer.svelte');
	return { default: MockDrawer };
});

vi.mock('./MapDrawerTabs.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/classes/MapState.svelte.js', () => ({
	MapState: class MockMapState {
		olMap = null;
		selectedProject = 'proj-1';
		initializeLayers = vi.fn().mockReturnValue(true);
		reinitializeForProject = vi.fn();
		reinitializeForGlobalView = vi.fn();
		refreshTileSources = vi.fn();
		updateNodeLayerStyle = vi.fn();
		updateTrenchLayerStyle = vi.fn();
		updateAddressLayerStyle = vi.fn();
		updateAreaLayerStyle = vi.fn();
		updateLabelVisibility = vi.fn();
		initializeSelectionLayers = vi.fn();
		getSelectionLayers = vi.fn().mockReturnValue([]);
		getLayerReferences = vi.fn().mockReturnValue({});
		getLayers = vi.fn().mockReturnValue([]);
		cleanup = vi.fn();
	}
}));

vi.mock('$lib/classes/MapSelectionManager.svelte.js', () => ({
	MapSelectionManager: class MockMapSelectionManager {
		clearSelection = vi.fn();
		registerSelectionLayer = vi.fn();
		getSelectionStore = vi.fn().mockReturnValue({});
		cleanup = vi.fn();
	}
}));

vi.mock('$lib/classes/MapPopupManager.svelte.js', () => ({
	MapPopupManager: class MockMapPopupManager {
		initialize = vi.fn();
		cleanup = vi.fn();
	}
}));

vi.mock('$lib/classes/MapInteractionManager.svelte.js', () => ({
	MapInteractionManager: class MockMapInteractionManager {
		setAdditionalDrawerProps = vi.fn();
		initialize = vi.fn();
		setSearchPanelRef = vi.fn();
		cleanup = vi.fn();
	}
}));

describe('/map/+page.svelte', () => {
	/** @type {any} */
	const mockData = {
		projects: [{ uuid: 'proj-1', name: 'Project 1' }],
		nodeTypes: [{ uuid: 'nt-1', name: 'Type A' }],
		surfaces: [{ uuid: 's-1', name: 'Asphalt' }],
		constructionTypes: [{ uuid: 'ct-1', name: 'Open' }],
		areaTypes: [{ uuid: 'at-1', name: 'Residential' }],
		alias: { trench: 'Trench', node: 'Node' },
		error: null
	};

	test('should render the map container when layers initialized', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('map')).toBeInTheDocument();
	});

	test('should render the Drawer component', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('drawer')).toBeInTheDocument();
	});

	test('should render the popup container', () => {
		render(Page, { props: { data: mockData } });

		const popup = document.getElementById('popup');
		expect(popup).toBeInTheDocument();
	});

	test('should render the popup content container', () => {
		render(Page, { props: { data: mockData } });

		const popupContent = document.getElementById('popup-content');
		expect(popupContent).toBeInTheDocument();
	});

	test('should render with all main UI components together', () => {
		render(Page, { props: { data: mockData } });

		expect(screen.getByTestId('map')).toBeInTheDocument();
		expect(screen.getByTestId('drawer')).toBeInTheDocument();
		expect(document.getElementById('popup')).toBeInTheDocument();
	});

	test('should render with empty nodeTypes array', () => {
		const emptyData = { ...mockData, nodeTypes: [] };
		render(Page, { props: { data: emptyData } });

		expect(screen.getByTestId('map')).toBeInTheDocument();
	});

	test('should render with null nodeTypes', () => {
		const nullData = { ...mockData, nodeTypes: null };
		render(Page, { props: { data: nullData } });

		expect(screen.getByTestId('map')).toBeInTheDocument();
	});
});
