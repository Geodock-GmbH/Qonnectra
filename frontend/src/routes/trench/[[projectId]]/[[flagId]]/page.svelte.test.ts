import '@testing-library/jest-dom/vitest';

import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { selectedConduit, selectedFlag, selectedProject } from '$lib/stores/store';

import Page from './+page.svelte';

const getConduitOptions = vi.fn();

type ManagerSpies = Record<'cleanup', ReturnType<typeof vi.fn>>;

const { pageState, mapStates, mapStateArgs, selectionManagers, layersInitialized } = vi.hoisted(
	() => ({
		pageState: {
			params: {} as Record<string, string | undefined>,
			url: new URL('http://localhost/trench'),
			data: {
				flags: [{ value: '2', label: 'Ausbau' }],
				flagsError: null,
				srid: 25832,
				proj4Def: ''
			}
		},
		mapStates: [] as ManagerSpies[],
		mapStateArgs: [] as unknown[][],
		selectionManagers: [] as ManagerSpies[],
		layersInitialized: { value: true }
	})
);

vi.mock('$lib/remote/trench/conduit-options.remote', () => ({
	getConduitOptions: (...args: unknown[]) => getConduitOptions(...args)
}));

vi.mock('$app/state', () => ({ page: pageState }));

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$app/paths', () => ({
	resolve: (_route: string, params: { projectId: string; flagId: string }) =>
		`/trench/${params.projectId}/${params.flagId}`
}));

vi.mock('ol/ol.css', () => ({}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/utils/fieldAliases', () => ({ getFieldAliases: () => ({}) }));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return {
		selectedProject: writable('1'),
		selectedFlag: writable(['2']),
		selectedConduit: writable(undefined),
		routingMode: writable(false),
		routingTolerance: writable([1]),
		showLinkedTrenches: writable(false),
		trenchColorSelected: writable('#ff0000'),
		trenchColor: writable('#000000'),
		trenchStyleMode: writable('default'),
		trenchSurfaceStyles: writable({}),
		trenchConstructionTypeStyles: writable({}),
		nodeTypeStyles: writable({}),
		areaTypeStyles: writable({}),
		addressStyle: writable({ color: '#0000ff', size: 6 }),
		labelVisibilityConfig: writable({})
	};
});

vi.mock('$lib/components/Map.svelte', async () => {
	const { default: MockMap } = await import('$lib/test-utils/mocks/MockMap.svelte');
	return { default: MockMap };
});

vi.mock('$lib/components/GenericCombobox.svelte', async () => {
	const { default: MockGenericCombobox } =
		await import('$lib/test-utils/mocks/MockGenericCombobox.svelte');
	return { default: MockGenericCombobox };
});

vi.mock('$lib/classes/MapState.svelte', () => ({
	MapState: class MockMapState {
		olMap = null;
		selectedProject = '1';
		vectorTileLayer = null;
		initializeLayers = vi.fn(() => layersInitialized.value);
		reinitializeForProject = vi.fn();
		refreshTileSources = vi.fn();
		updateNodeLayerStyle = vi.fn();
		updateTrenchLayerStyle = vi.fn();
		updateAddressLayerStyle = vi.fn();
		updateAreaLayerStyle = vi.fn();
		updateLabelVisibility = vi.fn();
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
		selectFeature = vi.fn();
		selectMultipleFeatures = vi.fn();
		cleanup = vi.fn();

		constructor() {
			selectionManagers.push(this);
		}
	}
}));

/**
 * @param path - Pathname the page is opened under.
 * @param params - Route params matched from that path.
 */
function openPage(path: string, params: Record<string, string | undefined> = {}) {
	pageState.url = new URL(`http://localhost${path}`);
	pageState.params = params;
	return render(Page);
}

beforeEach(() => {
	getConduitOptions.mockResolvedValue([{ value: 'conduit-1', label: 'Rohr 1 (7x10)' }]);
});

afterEach(() => {
	vi.mocked(goto).mockClear();
	getConduitOptions.mockReset();
	selectedProject.set('1');
	selectedFlag.set(['2']);
	selectedConduit.set(undefined);
	mapStates.length = 0;
	mapStateArgs.length = 0;
	selectionManagers.length = 0;
	layersInitialized.value = true;
});

describe('/trench/+page.svelte', () => {
	test('should show the map and the assignment controls', async () => {
		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		expect(await screen.findByTestId('map')).toBeInTheDocument();
		expect(document.querySelector('input[name="routing-mode"]')).toBeInTheDocument();
		expect(document.querySelector('input[name="show-linked-trenches"]')).toBeInTheDocument();
		expect(screen.getByText('message_no_trenches')).toBeInTheDocument();
	});

	test('should build the map for the selected project with every feature layer', () => {
		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		expect(mapStateArgs[0]).toEqual([
			'1',
			'#ff0000',
			{ trench: true, address: true, node: true, area: true }
		]);
	});

	test('should say so when the map tiles cannot be set up', () => {
		layersInitialized.value = false;

		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		expect(screen.getByText('message_error_could_not_load_map_tiles')).toBeInTheDocument();
		expect(screen.queryByTestId('map')).not.toBeInTheDocument();
	});

	test('should load the conduits of the project and flag', async () => {
		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		expect(await screen.findByPlaceholderText('placeholder_select_conduit')).toBeInTheDocument();
		expect(getConduitOptions).toHaveBeenCalledWith({ projectId: '1', flagId: '2' });
	});

	test('should complete a bare route with the stored project and flag', () => {
		openPage('/trench');

		expect(goto).toHaveBeenCalledWith('/trench/1/2', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});

	test('should leave a URL alone that already names the project and flag', () => {
		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		expect(goto).not.toHaveBeenCalled();
	});

	test('should follow a project or flag that changes later', () => {
		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		selectedFlag.set(['3']);
		expect(goto).toHaveBeenLastCalledWith('/trench/1/3', expect.anything());

		selectedProject.set('8');
		expect(goto).toHaveBeenLastCalledWith('/trench/8/3', expect.anything());
	});

	test('should adopt the project and flag named in the URL', () => {
		openPage('/trench/5/4', { projectId: '5', flagId: '4' });

		expect(get(selectedProject)).toBe('5');
		expect(get(selectedFlag)).toEqual(['4']);
		expect(goto).not.toHaveBeenCalled();
	});

	test('should keep a remembered conduit when the URL matches its project and flag', () => {
		selectedConduit.set('conduit-1');

		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		expect(get(selectedConduit)).toBe('conduit-1');
	});

	test('should forget a conduit remembered from another project', () => {
		selectedConduit.set('conduit-1');

		openPage('/trench/5/2', { projectId: '5', flagId: '2' });

		expect(get(selectedConduit)).toBeUndefined();
	});

	test('should forget a conduit remembered from another flag', () => {
		selectedConduit.set('conduit-1');

		openPage('/trench/1/4', { projectId: '1', flagId: '4' });

		expect(get(selectedConduit)).toBeUndefined();
	});

	test('should forget a remembered conduit the flag does not offer any more', async () => {
		selectedConduit.set('conduit-gone');

		openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		await vi.waitFor(() => expect(get(selectedConduit)).toBeUndefined());
	});

	test('should stop following the stores and release the map once it is left', () => {
		const { unmount } = openPage('/trench/1/2', { projectId: '1', flagId: '2' });

		unmount();
		selectedFlag.set(['3']);

		expect(goto).not.toHaveBeenCalled();
		expect(mapStates[0].cleanup).toHaveBeenCalled();
		expect(selectionManagers[0].cleanup).toHaveBeenCalled();
	});
});
