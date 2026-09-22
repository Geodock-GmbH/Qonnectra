import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { readyMap } from './ReadyMap.fixture.svelte';
import ValuationContextFixture from './ValuationContext.fixture.svelte';
import ValuationMap from './ValuationMap.svelte';
import { ValuationState } from './ValuationState.svelte';

const { mapStates, remote, toastError } = vi.hoisted(() => ({
	mapStates: [] as {
		olMap: unknown;
		areaLayer: object;
		ctorArgs: unknown[];
		reinitializeForProject: ReturnType<typeof vi.fn>;
		reinitializeForGlobalView: ReturnType<typeof vi.fn>;
		cleanup: ReturnType<typeof vi.fn>;
	}[],
	remote: { getLayerStyleAttributes: vi.fn(), getValuationAreas: vi.fn() },
	toastError: vi.fn()
}));

vi.mock('$lib/remote/map/layers.remote', () => ({
	getLayerStyleAttributes: remote.getLayerStyleAttributes
}));

vi.mock('$lib/remote/valuation/valuation.remote', () => ({
	getValuationAreas: remote.getValuationAreas
}));

vi.mock('$lib/stores/toaster', () => ({ globalToaster: { error: toastError } }));

vi.mock('$app/state', () => ({
	page: {
		params: { projectId: '7' },
		data: { srid: 25832, proj4Def: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs' }
	}
}));

vi.mock('ol/ol.css', () => ({}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return {
		selectedProject: writable('7'),
		globalMapView: writable(false),
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

vi.mock('$lib/components/Map.svelte', async () => ({
	default: (await import('./ReadyMap.fixture.svelte')).default
}));

vi.mock('$lib/classes/MapState.svelte', () => ({
	MapState: class {
		olMap: unknown = null;
		areaLayer = {};
		selectedProject: unknown;
		ctorArgs: unknown[];
		reinitializeForProject = vi.fn((project: string) => (this.selectedProject = project));
		reinitializeForGlobalView = vi.fn();
		cleanup = vi.fn();
		updateNodeLayerStyle = vi.fn();
		updateTrenchLayerStyle = vi.fn();
		updateAddressLayerStyle = vi.fn();
		updateAreaLayerStyle = vi.fn();
		updateLabelVisibility = vi.fn();

		constructor(...args: unknown[]) {
			this.ctorArgs = args;
			this.selectedProject = args[0];
			mapStates.push(this);
		}
		initializeLayers() {
			return true;
		}
		getLayers() {
			return [];
		}
	}
}));

const { selectedProject, globalMapView } = await import('$lib/stores/store');

const forEachFeatureAtPixel = vi.fn();

/**
 * @param featureId - Id of the area feature under the click; `null` for a miss.
 */
function renderMap(featureId: string | null = 'area-1') {
	forEachFeatureAtPixel.mockImplementation((_pixel, callback) =>
		featureId ? callback({ getId: () => featureId }) : undefined
	);
	const valuation = new ValuationState();
	const attach = vi.spyOn(valuation.highlight, 'attach').mockImplementation(() => {});
	const detach = vi.spyOn(valuation.highlight, 'detach');
	const { unmount } = render(ValuationContextFixture, {
		props: { component: ValuationMap, valuation }
	});
	return { valuation, attach, detach, unmount };
}

beforeEach(() => {
	mapStates.length = 0;
	readyMap.current = { forEachFeatureAtPixel };
	readyMap.deferred = false;
	selectedProject.set('7');
	globalMapView.set(false);
	remote.getLayerStyleAttributes.mockResolvedValue({
		nodeTypes: [{ id: 1, node_type: 'Muffe' }],
		surfaces: [],
		constructionTypes: [],
		areaTypes: []
	});
	remote.getValuationAreas.mockResolvedValue([
		{ uuid: 'area-1', name: 'Nord', areaType: null, geometry: null }
	]);
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('ValuationMap', () => {
	test('should hand the loaded attribute lists to the map', async () => {
		renderMap();

		expect(await screen.findByTestId('map')).toHaveAttribute('data-node-type-count', '1');
	});

	test('should surface failed layer attributes through the boundary', async () => {
		remote.getLayerStyleAttributes.mockRejectedValue(new Error('Forbidden'));

		renderMap();

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('Forbidden');
	});

	test('should start in the persisted global view', async () => {
		globalMapView.set(true);

		renderMap();
		await screen.findByTestId('map');

		expect(mapStates[0].ctorArgs[4]).toBe(true);
	});

	test('should attach the area outlines with the storage projection once the map is ready', async () => {
		const { attach } = renderMap();
		await screen.findByTestId('map');

		expect(attach).toHaveBeenCalledWith(readyMap.current, expect.objectContaining({ srid: 25832 }));
	});

	test('should toggle a clicked area that the list offers', async () => {
		const { valuation } = renderMap('area-1');

		await fireEvent.click(await screen.findByTestId('map'));

		await vi.waitFor(() => expect(valuation.selectedAreaUuids.has('area-1')).toBe(true));
		expect(remote.getValuationAreas).toHaveBeenCalledWith({ projectId: '7' });
	});

	test('should only consider the area layer under the click', async () => {
		renderMap();

		await fireEvent.click(await screen.findByTestId('map'));

		const [pixel, , options] = forEachFeatureAtPixel.mock.calls[0];
		expect(pixel).toEqual([5, 5]);
		expect(options.layerFilter(mapStates[0].areaLayer)).toBe(true);
		expect(options.layerFilter({})).toBe(false);
	});

	test('should ignore a clicked area that the list does not offer', async () => {
		const { valuation } = renderMap('area-of-another-project');

		await fireEvent.click(await screen.findByTestId('map'));

		await vi.waitFor(() => expect(remote.getValuationAreas).toHaveBeenCalled());
		expect(valuation.selectedAreaUuids.size).toBe(0);
	});

	test('should ignore a click that hits no area', async () => {
		const { valuation } = renderMap(null);

		await fireEvent.click(await screen.findByTestId('map'));

		expect(remote.getValuationAreas).not.toHaveBeenCalled();
		expect(valuation.selectedAreaUuids.size).toBe(0);
	});

	test('should report areas that cannot be loaded for a click', async () => {
		remote.getValuationAreas.mockRejectedValue(new Error('Failed to load areas'));
		renderMap();

		await fireEvent.click(await screen.findByTestId('map'));

		await vi.waitFor(() =>
			expect(toastError).toHaveBeenCalledWith({
				title: 'common_error',
				description: 'Failed to load areas'
			})
		);
	});

	test('should rebuild the tile sources when the project changes', async () => {
		renderMap();
		await screen.findByTestId('map');

		selectedProject.set('8');

		expect(mapStates[0].reinitializeForProject).toHaveBeenCalledWith('8');
	});

	test('should rebuild the tile sources when the global view is toggled', async () => {
		renderMap();
		await screen.findByTestId('map');

		globalMapView.set(true);

		expect(mapStates[0].reinitializeForGlobalView).toHaveBeenLastCalledWith(true);
	});

	test('should catch up on a project switched while the map was still loading', async () => {
		readyMap.deferred = true;
		renderMap();
		await screen.findByTestId('map');

		selectedProject.set('8');
		expect(mapStates[0].reinitializeForProject).not.toHaveBeenCalled();

		readyMap.announce();

		expect(mapStates[0].reinitializeForProject).toHaveBeenCalledWith('8');
	});

	test('should catch up on a global view toggled while the map was still loading', async () => {
		readyMap.deferred = true;
		renderMap();
		await screen.findByTestId('map');

		globalMapView.set(true);
		expect(mapStates[0].reinitializeForGlobalView).not.toHaveBeenCalled();

		readyMap.announce();

		expect(mapStates[0].reinitializeForGlobalView).toHaveBeenCalledWith(true);
	});

	test('should detach the outlines and clean up the map state when unmounted', async () => {
		const { detach, unmount } = renderMap();
		await screen.findByTestId('map');

		unmount();

		expect(detach).toHaveBeenCalled();
		expect(mapStates[0].cleanup).toHaveBeenCalled();
	});
});
