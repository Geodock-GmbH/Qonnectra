import '@testing-library/jest-dom/vitest';

import type { TrenchMapManagers } from './trenchMapContext';
import { tick } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { routingMode, routingTolerance, selectedProject } from '$lib/stores/store';

import { TrenchAssignmentState } from './TrenchAssignmentState.svelte';
import TrenchContextFixture from './TrenchContext.fixture.svelte';
import TrenchMap from './TrenchMap.svelte';

const getLayerStyleAttributes = vi.fn();

vi.mock('$lib/remote/map/layers.remote', () => ({
	getLayerStyleAttributes: (...args: unknown[]) => getLayerStyleAttributes(...args)
}));

vi.mock('$app/state', () => ({
	page: { data: { srid: 25832, proj4Def: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs' } }
}));

vi.mock('ol/ol.css', () => ({}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return {
		selectedProject: writable('7'),
		selectedConduit: writable(undefined),
		routingMode: writable(false),
		routingTolerance: writable([2.5]),
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

const trenchFeature = {
	get: (key: string) => (key === 'id_trench' ? 'T-100' : undefined),
	getId: () => 'trench-100'
};

function createMapState(features: unknown[] = [trenchFeature]) {
	const vectorTileLayer = { getSource: vi.fn().mockReturnValue(null) };
	return {
		olMap: { getFeaturesAtPixel: vi.fn().mockReturnValue(features) },
		selectedProject: '7',
		vectorTileLayer,
		reinitializeForProject: vi.fn(),
		refreshTileSources: vi.fn(),
		updateNodeLayerStyle: vi.fn(),
		updateTrenchLayerStyle: vi.fn(),
		updateAddressLayerStyle: vi.fn(),
		updateAreaLayerStyle: vi.fn(),
		updateLabelVisibility: vi.fn(),
		getLayers: vi.fn().mockReturnValue([])
	};
}

/**
 * @param options.conduitUuid - Conduit the assignment starts with; `null` for none.
 * @param options.features - What the map reports under a click.
 */
function renderMap(options: { conduitUuid?: string | null; features?: unknown[] } = {}) {
	const selectionManager = {
		selectFeature: vi.fn(),
		selectMultipleFeatures: vi.fn(),
		clearSelection: vi.fn()
	};
	const conduitUuid = options.conduitUuid === undefined ? 'conduit-1' : options.conduitUuid;
	const assignment = new TrenchAssignmentState(selectionManager, conduitUuid ?? undefined);
	const pickTrench = vi.spyOn(assignment, 'pickTrench').mockResolvedValue(undefined);
	const mapState = createMapState(options.features);
	const { unmount } = render(TrenchContextFixture, {
		props: {
			component: TrenchMap,
			props: { alias: {} },
			assignment,
			managers: { mapState, selectionManager } as unknown as TrenchMapManagers
		}
	});
	return { assignment, pickTrench, mapState, unmount };
}

beforeEach(() => {
	getLayerStyleAttributes.mockResolvedValue({
		nodeTypes: [{ id: 1, node_type: 'Muffe' }],
		surfaces: [],
		constructionTypes: [],
		areaTypes: []
	});
});

afterEach(() => {
	getLayerStyleAttributes.mockReset();
	selectedProject.set('7');
	routingMode.set(false);
	routingTolerance.set([2.5]);
});

describe('TrenchMap', () => {
	test('should hand the loaded attribute lists to the map', async () => {
		renderMap();

		expect(await screen.findByTestId('map')).toHaveAttribute('data-node-type-count', '1');
	});

	test('should surface failed layer attributes through the boundary', async () => {
		getLayerStyleAttributes.mockRejectedValue(new Error('Forbidden'));

		renderMap();

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('Forbidden');
	});

	test('should hand a clicked trench to the assignment', async () => {
		const { pickTrench, mapState } = renderMap();

		await fireEvent.click(await screen.findByTestId('map'));

		expect(mapState.olMap.getFeaturesAtPixel).toHaveBeenCalledWith(
			undefined,
			expect.objectContaining({ hitTolerance: 10 })
		);
		expect(pickTrench).toHaveBeenCalledWith(
			{ uuid: 'trench-100', label: 'T-100', feature: trenchFeature },
			{ enabled: false, projectId: '7', tolerance: 2.5, dataProjection: 'EPSG:25832' }
		);
	});

	test('should read the routing mode at the moment of the click', async () => {
		const { pickTrench } = renderMap();
		const map = await screen.findByTestId('map');

		routingMode.set(true);
		await fireEvent.click(map);

		expect(pickTrench).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ enabled: true })
		);
	});

	test('should only consider the trench layer under the click', async () => {
		const { mapState } = renderMap();

		await fireEvent.click(await screen.findByTestId('map'));

		const { layerFilter } = mapState.olMap.getFeaturesAtPixel.mock.calls[0][1];
		expect(layerFilter(mapState.vectorTileLayer)).toBe(true);
		expect(layerFilter({})).toBe(false);
	});

	test('should ignore a click that hits no trench', async () => {
		const { pickTrench } = renderMap({ features: [] });

		await fireEvent.click(await screen.findByTestId('map'));

		expect(pickTrench).not.toHaveBeenCalled();
	});

	test('should ask for a conduit while none is selected', async () => {
		renderMap({ conduitUuid: null });
		await screen.findByTestId('map');

		expect(screen.getByText('message_map_hint_assign_conduit')).toBeVisible();
	});

	test('should not ask for a conduit once one is selected', async () => {
		renderMap({ conduitUuid: 'conduit-1' });
		await screen.findByTestId('map');

		expect(screen.queryByText('message_map_hint_assign_conduit')).not.toBeInTheDocument();
	});

	test('should cover the map while a route is calculated', async () => {
		const { assignment } = renderMap();
		await screen.findByTestId('map');
		expect(screen.queryByText('message_calculating_route')).not.toBeInTheDocument();

		assignment.isCalculatingRoute = true;
		await tick();

		expect(screen.getByText('message_calculating_route')).toBeInTheDocument();
	});

	test('should apply the stored layer styles and refresh the tiles once mounted', async () => {
		const { mapState } = renderMap();
		await screen.findByTestId('map');

		expect(mapState.updateTrenchLayerStyle).toHaveBeenCalledWith('default', {}, {}, '#000000');
		expect(mapState.refreshTileSources).toHaveBeenCalled();
	});

	test('should drop the conduit and its highlights when the project changes', async () => {
		const { assignment, mapState } = renderMap();
		await screen.findByTestId('map');
		assignment.trenchHighlights.show('conduit-1', ['trench-1']);
		const setSource = vi.spyOn(assignment.trenchHighlights, 'setSource');

		selectedProject.set('8');

		expect(mapState.reinitializeForProject).toHaveBeenCalledWith('8');
		expect(assignment.conduitUuid).toBeUndefined();
		expect(assignment.trenchHighlights.isHighlighted('trench-1')).toBe(false);
		expect(setSource).toHaveBeenCalled();
	});

	test('should stop following the project once it is unmounted', async () => {
		const { mapState, unmount } = renderMap();
		await screen.findByTestId('map');

		unmount();
		selectedProject.set('9');

		expect(mapState.reinitializeForProject).not.toHaveBeenCalled();
	});
});
