import '@testing-library/jest-dom/vitest';

import type { PageData } from './$types';
import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { httpError } from '$lib/test-utils/remote-stubs';

import Page from './+page.svelte';

const getLayerStyleAttributes = vi.fn();

vi.mock('$lib/remote/map/layers.remote', () => ({
	getLayerStyleAttributes: (...args: unknown[]) => getLayerStyleAttributes(...args)
}));

type MapStateSpies = Record<
	'updateTrenchLayerStyle' | 'updateAddressLayerStyle' | 'refreshTileSources' | 'cleanup',
	ReturnType<typeof vi.fn>
>;

const { mapStates } = vi.hoisted(() => ({ mapStates: [] as MapStateSpies[] }));

vi.mock('$lib/paraglide/messages', () => {
	const mockMessages = new Proxy(
		{},
		{
			get: (target, prop) => {
				const messageMap: Record<string, string> = {
					nav_map: 'Map',
					title_error_loading_map_features: 'Error loading map features',
					message_error_could_not_load_map_tiles: 'Could not load map tiles'
				};
				return () => messageMap[prop as string] || String(prop);
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
		subscribe: (cb: (...args: unknown[]) => unknown) => {
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
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb('proj-1');
			return () => {};
		}
	},
	globalMapView: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb(false);
			return () => {};
		}
	},
	nodeTypeStyles: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb({});
			return () => {};
		}
	},
	trenchStyleMode: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb('default');
			return () => {};
		}
	},
	trenchSurfaceStyles: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb({});
			return () => {};
		}
	},
	trenchConstructionTypeStyles: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb({});
			return () => {};
		}
	},
	trenchColor: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb('#000000');
			return () => {};
		}
	},
	trenchColorSelected: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb('#ff0000');
			return () => {};
		}
	},
	addressStyle: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb({ color: '#0000ff', size: 6 });
			return () => {};
		}
	},
	areaTypeStyles: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb({});
			return () => {};
		}
	},
	labelVisibilityConfig: {
		subscribe: (cb: (...args: unknown[]) => unknown) => {
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

vi.mock('./components/drawer/MapDrawerTabs.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/classes/MapState.svelte', () => ({
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

		constructor() {
			mapStates.push(this);
		}
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
	const data: PageData = {
		user: { isAuthenticated: true },
		flags: [],
		flagsError: null,
		projects: [{ label: 'Project 1', value: 'proj-1' }],
		projectsError: null,
		appVersion: null,
		selectedProject: 'proj-1',
		srid: null,
		proj4Def: null
	};

	beforeEach(() => {
		getLayerStyleAttributes.mockResolvedValue({
			nodeTypes: [],
			surfaces: [],
			constructionTypes: [],
			areaTypes: []
		});
	});

	afterEach(() => {
		getLayerStyleAttributes.mockReset();
		mapStates.length = 0;
	});

	test('should show a loading placeholder until the layer attributes arrive', async () => {
		render(Page, { props: { data } });

		expect(screen.getByRole('status')).toBeInTheDocument();
		expect(screen.queryByTestId('map')).not.toBeInTheDocument();

		expect(await screen.findByTestId('map')).toBeInTheDocument();
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	test('should hand the loaded attribute lists to the map', async () => {
		getLayerStyleAttributes.mockResolvedValue({
			nodeTypes: [{ id: 1, node_type: 'Muffe' }],
			surfaces: [],
			constructionTypes: [],
			areaTypes: []
		});

		render(Page, { props: { data } });

		expect(await screen.findByTestId('map')).toHaveAttribute('data-node-type-count', '1');
	});

	test('should render the popup containers next to the map', async () => {
		render(Page, { props: { data } });
		await screen.findByTestId('map');

		expect(document.getElementById('popup')).toBeInTheDocument();
		expect(document.getElementById('popup-content')).toBeInTheDocument();
	});

	test('should render the Drawer component', () => {
		render(Page, { props: { data } });

		expect(screen.getByTestId('drawer')).toBeInTheDocument();
	});

	test('should apply the stored layer styles once the map is mounted', async () => {
		render(Page, { props: { data } });
		await screen.findByTestId('map');

		const [mapState] = mapStates;
		expect(mapState.updateTrenchLayerStyle).toHaveBeenCalledWith('default', {}, {}, '#000000');
		expect(mapState.updateAddressLayerStyle).toHaveBeenCalledWith('#0000ff', 6);
		expect(mapState.refreshTileSources).toHaveBeenCalledOnce();
	});

	test('should offer a retry when the layer attributes fail to load', async () => {
		getLayerStyleAttributes.mockRejectedValue(httpError(502, 'Backend unavailable'));

		render(Page, { props: { data } });

		expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable');
		expect(screen.queryByTestId('map')).not.toBeInTheDocument();
	});

	test('should release the map when the page is left', async () => {
		const { unmount } = render(Page, { props: { data } });
		await screen.findByTestId('map');

		unmount();

		expect(mapStates[0].cleanup).toHaveBeenCalledOnce();
	});
});
