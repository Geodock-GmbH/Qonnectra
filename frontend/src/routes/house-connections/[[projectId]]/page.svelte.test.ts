import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { httpError } from '$lib/test-utils/remote-stubs';

import Page from './+page.svelte';

const getLayerStyleAttributes = vi.fn();

vi.mock('$lib/remote/map/layers.remote', () => ({
	getLayerStyleAttributes: (...args: unknown[]) => getLayerStyleAttributes(...args)
}));

type MapStateSpies = Record<
	| 'updateTrenchLayerStyle'
	| 'updateAddressLayerStyle'
	| 'refreshTileSources'
	| 'reinitializeForGlobalView'
	| 'cleanup',
	ReturnType<typeof vi.fn>
>;

const { mapStates, mapStateArgs, interactionManagerArgs } = vi.hoisted(() => ({
	mapStates: [] as MapStateSpies[],
	mapStateArgs: [] as unknown[][],
	interactionManagerArgs: [] as unknown[][]
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_TILE_SERVER_URL: '' }
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
		info: vi.fn()
	}
}));

vi.mock('$lib/stores/store', () => {
	const fixed = (value: unknown) => ({
		subscribe: (cb: (...args: unknown[]) => unknown) => {
			cb(value);
			return () => {};
		}
	});
	return {
		selectedProject: fixed('proj-1'),
		globalMapView: fixed(true),
		nodeTypeStyles: fixed({}),
		trenchStyleMode: fixed('default'),
		trenchSurfaceStyles: fixed({}),
		trenchConstructionTypeStyles: fixed({}),
		trenchColor: fixed('#000000'),
		trenchColorSelected: fixed('#ff0000'),
		addressStyle: fixed({ color: '#0000ff', size: 6 }),
		areaTypeStyles: fixed({}),
		labelVisibilityConfig: fixed({})
	};
});

vi.mock('$lib/components/Map.svelte', async () => {
	const { default: MockMap } = await import('$lib/test-utils/mocks/MockMap.svelte');
	return { default: MockMap };
});

vi.mock('$lib/components/Drawer.svelte', async () => {
	const { default: MockDrawer } = await import('$lib/test-utils/mocks/MockDrawer.svelte');
	return { default: MockDrawer };
});

vi.mock('./components/drawer/HouseConnectionDrawerTabs.svelte', () => ({
	default: vi.fn()
}));

vi.mock('$lib/classes/MapState.svelte', () => ({
	MapState: class MockMapState {
		olMap = {};
		selectedProject = 'proj-1';
		vectorTileLayer = null;
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

		constructor(...args: unknown[]) {
			mapStateArgs.push(args);
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

vi.mock('$lib/classes/MapInteractionManager.svelte', () => ({
	MapInteractionManager: class MockMapInteractionManager {
		olMap = null;
		layers = {};
		selectableLayersConfig = {};
		handleFeatureClick = vi.fn();
		initialize = vi.fn();
		cleanup = vi.fn();

		constructor(...args: unknown[]) {
			interactionManagerArgs.push(args);
		}
	}
}));

describe('/house-connections/+page.svelte', () => {
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
		mapStateArgs.length = 0;
		interactionManagerArgs.length = 0;
	});

	test('should show a loading placeholder until the layer attributes arrive', async () => {
		render(Page);

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

		render(Page);

		expect(await screen.findByTestId('map')).toHaveAttribute('data-node-type-count', '1');
	});

	test('should build the map for the selected project with every feature layer', () => {
		render(Page);

		expect(mapStateArgs[0]).toEqual([
			'proj-1',
			'#ff0000',
			{ trench: true, address: true, node: true, area: true }
		]);
	});

	test('should let only trenches open the drawer', () => {
		render(Page);

		expect(interactionManagerArgs[0][5]).toEqual({
			trench: true,
			address: false,
			node: false,
			area: false
		});
	});

	test('should render the Drawer component', () => {
		render(Page);

		expect(screen.getByTestId('drawer')).toBeInTheDocument();
	});

	test('should apply the stored layer styles once the map is mounted', async () => {
		render(Page);
		await screen.findByTestId('map');

		const [mapState] = mapStates;
		expect(mapState.updateTrenchLayerStyle).toHaveBeenCalledWith('default', {}, {}, '#000000');
		expect(mapState.updateAddressLayerStyle).toHaveBeenCalledWith('#0000ff', 6);
		expect(mapState.refreshTileSources).toHaveBeenCalledOnce();
	});

	test('should stay scoped to the project while the global view is switched on', async () => {
		render(Page);
		await screen.findByTestId('map');

		expect(mapStates[0].reinitializeForGlobalView).not.toHaveBeenCalled();
	});

	test('should offer a retry when the layer attributes fail to load', async () => {
		getLayerStyleAttributes.mockRejectedValue(httpError(502, 'Backend unavailable'));

		render(Page);

		expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable');
		expect(screen.queryByTestId('map')).not.toBeInTheDocument();
	});

	test('should release the map when the page is left', async () => {
		const { unmount } = render(Page);
		await screen.findByTestId('map');

		unmount();

		expect(mapStates[0].cleanup).toHaveBeenCalledOnce();
	});
});
