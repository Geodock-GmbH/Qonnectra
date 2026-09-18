import Feature from 'ol/Feature.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import { TrenchAssignmentState } from './TrenchAssignmentState.svelte';

const createTrenchConnections = vi.fn();
const calculateRoute = vi.fn();
const getConduitOptions = vi.fn();
const storedConduit = vi.fn();

vi.mock('$lib/remote/trench/connections.remote', () => ({
	createTrenchConnections: (...args: unknown[]) => createTrenchConnections(...args)
}));

vi.mock('$lib/remote/trench/routing.remote', () => ({
	calculateRoute: (...args: unknown[]) => calculateRoute(...args)
}));

vi.mock('$lib/remote/trench/conduit-options.remote', () => ({
	getConduitOptions: (...args: unknown[]) => getConduitOptions(...args)
}));

vi.mock('$lib/stores/store', () => ({
	selectedConduit: { set: (value: unknown) => storedConduit(value) }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const routing = { enabled: true, projectId: '7', tolerance: 2, dataProjection: 'EPSG:25832' };
const clicking = { ...routing, enabled: false };

function createSelection() {
	return {
		selectFeature: vi.fn(),
		selectMultipleFeatures: vi.fn(),
		clearSelection: vi.fn()
	};
}

function trench(uuid: string, label: string) {
	return { uuid, label, feature: new Feature() };
}

/**
 * @param conduitUuid - Restored conduit; `null` starts without one.
 */
function createState(conduitUuid: string | null = 'conduit-1') {
	const selection = createSelection();
	const state = new TrenchAssignmentState(selection, conduitUuid ?? undefined);
	const showRoute = vi.spyOn(state.routeOverlay, 'showRoute').mockImplementation(() => undefined);
	const clearRoute = vi.spyOn(state.routeOverlay, 'clear');
	return { state, selection, showRoute, clearRoute };
}

beforeEach(() => {
	createTrenchConnections.mockImplementation(() => commandResult({ created: 1 }));
	calculateRoute.mockResolvedValue({
		pathWkt: 'LINESTRING(0 0, 1 1)',
		trenches: [
			{ uuid: 'trench-1', label: 'T-1' },
			{ uuid: 'trench-2', label: 'T-2' },
			{ uuid: 'trench-3', label: 'T-3' }
		]
	});
});

afterEach(() => {
	vi.clearAllMocks();
	createTrenchConnections.mockReset();
	calculateRoute.mockReset();
	getConduitOptions.mockReset();
});

describe('TrenchAssignmentState: conduit selection', () => {
	test('should start from the restored conduit', () => {
		expect(createState('conduit-9').state.conduitUuid).toBe('conduit-9');
	});

	test('should persist the picked conduit and drop the route in progress', async () => {
		const { state, selection, clearRoute } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		state.selectConduit('conduit-2');

		expect(state.conduitUuid).toBe('conduit-2');
		expect(storedConduit).toHaveBeenCalledWith('conduit-2');
		expect(selection.clearSelection).toHaveBeenCalled();
		expect(clearRoute).toHaveBeenCalled();
	});

	test('should keep a restored conduit that the project and flag still offer', async () => {
		getConduitOptions.mockResolvedValue([{ value: 'conduit-1', label: 'Rohr 1' }]);
		const { state } = createState();

		await state.validateConduit('7', '2');

		expect(getConduitOptions).toHaveBeenCalledWith({ projectId: '7', flagId: '2' });
		expect(state.conduitUuid).toBe('conduit-1');
	});

	test('should drop a restored conduit that is not offered any more', async () => {
		getConduitOptions.mockResolvedValue([{ value: 'conduit-5', label: 'Rohr 5' }]);
		const { state } = createState();

		await state.validateConduit('7', '2');

		expect(state.conduitUuid).toBeUndefined();
		expect(storedConduit).toHaveBeenCalledWith(undefined);
	});

	test('should not drop a conduit picked while the validation was in flight', async () => {
		let resolveOptions: (options: unknown[]) => void = () => undefined;
		getConduitOptions.mockReturnValue(new Promise((resolve) => (resolveOptions = resolve)));
		const { state } = createState();

		const validation = state.validateConduit('7', '2');
		state.selectConduit('conduit-2');
		resolveOptions([]);
		await validation;

		expect(state.conduitUuid).toBe('conduit-2');
	});

	test('should leave the conduit alone when the options cannot be loaded', async () => {
		getConduitOptions.mockRejectedValue(httpError(500, 'Boom'));
		const { state } = createState();

		await state.validateConduit('7', '2');

		expect(state.conduitUuid).toBe('conduit-1');
	});

	test('should not look anything up without a conduit, project or flag', async () => {
		await createState(null).state.validateConduit('7', '2');
		await createState().state.validateConduit('7', undefined);

		expect(getConduitOptions).not.toHaveBeenCalled();
	});
});

describe('TrenchAssignmentState: picking a trench', () => {
	test('should refuse a pick while no conduit is selected', async () => {
		const { state, selection } = createState(null);

		await state.pickTrench(trench('trench-1', 'T-1'), clicking);

		expect(globalToaster.error).toHaveBeenCalledWith({
			title: 'title_no_conduit_selected',
			description: 'message_no_conduit_selected_description'
		});
		expect(selection.selectFeature).not.toHaveBeenCalled();
		expect(createTrenchConnections).not.toHaveBeenCalled();
	});

	test('should select the trench and connect it to the conduit', async () => {
		const { state, selection } = createState();
		const picked = trench('trench-1', 'T-1');

		await state.pickTrench(picked, clicking);

		expect(selection.selectFeature).toHaveBeenCalledWith('trench-1', picked.feature);
		expect(createTrenchConnections).toHaveBeenCalledWith({
			conduitUuid: 'conduit-1',
			trenchUuids: ['trench-1']
		});
		expect(globalToaster.success).toHaveBeenCalledWith({
			description: 'message_trench_connection_saved'
		});
	});

	test('should warn when the conduit already runs through the trench', async () => {
		createTrenchConnections.mockImplementation(() => commandResult({ created: 0 }));
		const { state } = createState();

		await state.pickTrench(trench('trench-1', 'T-1'), clicking);

		expect(globalToaster.warning).toHaveBeenCalledWith({
			description: 'message_no_new_trench_connections'
		});
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should report the backend’s reason when the connection is rejected', async () => {
		createTrenchConnections.mockImplementation(() =>
			commandFailure(httpError(400, 'uuid_trench: Invalid pk'))
		);
		const { state } = createState();

		await state.pickTrench(trench('trench-1', 'T-1'), clicking);

		expect(globalToaster.error).toHaveBeenCalledWith({
			title: 'common_error',
			description: 'uuid_trench: Invalid pk'
		});
	});
});

describe('TrenchAssignmentState: routing', () => {
	test('should wait for a second trench before calculating', async () => {
		const { state, selection } = createState();

		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		expect(selection.selectFeature).toHaveBeenCalledTimes(1);
		expect(calculateRoute).not.toHaveBeenCalled();
	});

	test('should ignore the start trench being picked again', async () => {
		const { state } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		expect(calculateRoute).not.toHaveBeenCalled();
	});

	test('should route between two trenches, draw the path and connect every trench on it', async () => {
		const { state, selection, showRoute } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		await state.pickTrench(trench('trench-3', 'T-3'), routing);

		expect(calculateRoute).toHaveBeenCalledWith({
			startTrenchId: 'T-1',
			endTrenchId: 'T-3',
			projectId: '7',
			tolerance: 2
		});
		expect(showRoute).toHaveBeenCalledWith('LINESTRING(0 0, 1 1)', 'EPSG:25832');
		expect(selection.selectMultipleFeatures).toHaveBeenCalledWith([
			'trench-1',
			'trench-2',
			'trench-3'
		]);
		expect(createTrenchConnections).toHaveBeenCalledWith({
			conduitUuid: 'conduit-1',
			trenchUuids: ['trench-1', 'trench-2', 'trench-3']
		});
		expect(state.isCalculatingRoute).toBe(false);
	});

	test('should flag the calculation while it is in flight', async () => {
		let resolveRoute: (route: unknown) => void = () => undefined;
		calculateRoute.mockReturnValue(new Promise((resolve) => (resolveRoute = resolve)));
		const { state } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		const pending = state.pickTrench(trench('trench-3', 'T-3'), routing);
		expect(state.isCalculatingRoute).toBe(true);

		resolveRoute({ pathWkt: 'LINESTRING(0 0, 1 1)', trenches: [] });
		await pending;
		expect(state.isCalculatingRoute).toBe(false);
	});

	test('should ignore picks while a route is being calculated', async () => {
		let resolveRoute: (route: unknown) => void = () => undefined;
		calculateRoute.mockReturnValue(new Promise((resolve) => (resolveRoute = resolve)));
		const { state, selection } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);
		const pending = state.pickTrench(trench('trench-3', 'T-3'), routing);

		await state.pickTrench(trench('trench-9', 'T-9'), routing);

		expect(selection.selectFeature).toHaveBeenCalledTimes(2);
		resolveRoute({ pathWkt: 'LINESTRING(0 0, 1 1)', trenches: [] });
		await pending;
	});

	test('should start a new route with the pick after a finished one', async () => {
		const { state, clearRoute } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);
		await state.pickTrench(trench('trench-3', 'T-3'), routing);
		calculateRoute.mockClear();

		await state.pickTrench(trench('trench-5', 'T-5'), routing);
		await state.pickTrench(trench('trench-6', 'T-6'), routing);

		expect(clearRoute).toHaveBeenCalled();
		expect(calculateRoute).toHaveBeenCalledWith(
			expect.objectContaining({ startTrenchId: 'T-5', endTrenchId: 'T-6' })
		);
	});

	test('should report a failed route and start over', async () => {
		calculateRoute.mockRejectedValue(httpError(404, 'No path found'));
		const { state, selection } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		await state.pickTrench(trench('trench-3', 'T-3'), routing);

		expect(globalToaster.error).toHaveBeenCalledWith({
			title: 'title_error_calculating_route',
			description: 'No path found'
		});
		expect(selection.clearSelection).toHaveBeenCalled();
		expect(createTrenchConnections).not.toHaveBeenCalled();
		expect(state.isCalculatingRoute).toBe(false);

		calculateRoute.mockResolvedValue({ pathWkt: 'LINESTRING(0 0, 1 1)', trenches: [] });
		await state.pickTrench(trench('trench-5', 'T-5'), routing);
		expect(calculateRoute).toHaveBeenCalledTimes(1);
	});

	test('should drop the route in progress on reset', async () => {
		const { state, selection, clearRoute } = createState();
		await state.pickTrench(trench('trench-1', 'T-1'), routing);

		state.resetRoute();
		await state.pickTrench(trench('trench-3', 'T-3'), routing);

		expect(selection.clearSelection).toHaveBeenCalled();
		expect(clearRoute).toHaveBeenCalled();
		expect(calculateRoute).not.toHaveBeenCalled();
	});
});
