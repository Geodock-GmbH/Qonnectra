import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { TrenchProfileState } from './TrenchProfileState.svelte';

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: {
		common_error: () => 'Fehler'
	}
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

const fetchMock = vi.fn();

const conduitData = {
	conduit_uuid: 'c1',
	conduit_name: 'DA 50',
	conduit_type: 'Rohr',
	microducts: [{ uuid: 'm1', color: 'rot' }],
	has_saved_position: true,
	canvas_x: 10,
	canvas_y: 20,
	canvas_width: 100,
	canvas_height: 60
};

function mockActionResponse(payload: unknown) {
	fetchMock.mockResolvedValue({
		text: () => Promise.resolve(JSON.stringify(payload))
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	vi.mocked(globalToaster.error).mockClear();
});

describe('initialize', () => {
	test('should load the profile and transform conduits into nodes', async () => {
		mockActionResponse({ type: 'success', data: [conduitData] });
		const state = new TrenchProfileState();

		await state.initialize('trench-1');

		expect(state.initialized).toBe(true);
		expect(state.isLoading).toBe(false);
		expect(state.trenchUuid).toBe('trench-1');
		expect(state.nodes).toEqual([
			{
				id: 'c1',
				type: 'trenchProfileNode',
				position: { x: 10, y: 20 },
				style: 'width: 100px; height: 60px;',
				selected: false,
				data: {
					conduit: {
						uuid: 'c1',
						conduit_name: 'DA 50',
						conduit_type: 'Rohr',
						microducts: [{ uuid: 'm1', color: 'rot' }]
					}
				}
			}
		]);
	});

	test('should not initialize twice', async () => {
		mockActionResponse({ type: 'success', data: [] });
		const state = new TrenchProfileState();

		await state.initialize('trench-1');
		await state.initialize('trench-1');

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test('should do nothing without a trench uuid', async () => {
		const state = new TrenchProfileState();

		await state.initialize('');

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should toast an error when loading fails', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		const state = new TrenchProfileState();

		await state.initialize('trench-1');

		expect(state.initialized).toBe(false);
		expect(state.isLoading).toBe(false);
		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('reset', () => {
	test('should clear all state so a new trench can be loaded', async () => {
		mockActionResponse({ type: 'success', data: [conduitData] });
		const state = new TrenchProfileState();
		await state.initialize('trench-1');

		state.reset();

		expect(state.nodes).toEqual([]);
		expect(state.trenchUuid).toBeNull();
		expect(state.initialized).toBe(false);
	});
});

describe('transformToSvelteFlowNodes', () => {
	test('should fall back to grid positions for unsaved conduits', () => {
		const state = new TrenchProfileState();
		const unsaved = {
			...conduitData,
			has_saved_position: false,
			canvas_x: null,
			canvas_y: null,
			canvas_width: null,
			canvas_height: null
		};

		const nodes = state.transformToSvelteFlowNodes([
			unsaved,
			{ ...unsaved, conduit_uuid: 'c2' },
			{ ...unsaved, conduit_uuid: 'c3' },
			{ ...unsaved, conduit_uuid: 'c4' }
		]);

		expect(nodes.map((n) => n.position)).toEqual([
			{ x: 0, y: 0 },
			{ x: 120, y: 0 },
			{ x: 0, y: 120 },
			{ x: 120, y: 120 }
		]);
		expect(nodes[0].style).toBe('width: 80px; height: 80px;');
	});

	test('should skip conduits without a uuid and handle empty input', () => {
		const state = new TrenchProfileState();

		expect(state.transformToSvelteFlowNodes([])).toEqual([]);
		expect(state.transformToSvelteFlowNodes([{ ...conduitData, conduit_uuid: '' }])).toEqual([]);
	});
});

describe('getGridPosition', () => {
	test('should lay out conduits in a square grid', () => {
		const state = new TrenchProfileState();

		expect(state.getGridPosition(0, 9)).toEqual({ x: 0, y: 0 });
		expect(state.getGridPosition(2, 9)).toEqual({ x: 240, y: 0 });
		expect(state.getGridPosition(3, 9)).toEqual({ x: 0, y: 120 });
	});
});

describe('position saving', () => {
	async function initializedState(): Promise<TrenchProfileState> {
		mockActionResponse({ type: 'success', data: [conduitData] });
		const state = new TrenchProfileState();
		await state.initialize('trench-1');
		fetchMock.mockReset();
		return state;
	}

	test('should save the node position after a drag', async () => {
		const state = await initializedState();
		mockActionResponse({ type: 'success' });

		await state.handleNodeDragStop({
			targetNode: {
				id: 'c1',
				position: { x: 30, y: 40 },
				measured: { width: 90, height: 70 }
			}
		});

		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(fetchMock.mock.calls[0][0]).toBe('?/saveTrenchProfilePosition');
		expect(body.get('trenchUuid')).toBe('trench-1');
		expect(body.get('conduitUuid')).toBe('c1');
		expect(body.get('canvasX')).toBe('30');
		expect(body.get('canvasY')).toBe('40');
		expect(body.get('canvasWidth')).toBe('90');
		expect(body.get('canvasHeight')).toBe('70');
	});

	test('should ignore drag events without a target node', async () => {
		const state = await initializedState();

		await state.handleNodeDragStop({ targetNode: null });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should fall back to default dimensions when saving resized nodes', async () => {
		const state = await initializedState();
		mockActionResponse({ type: 'success' });

		await state.saveNodeDimensions({ id: 'c1', position: { x: 1, y: 2 } });

		const body = fetchMock.mock.calls[0][1].body as FormData;
		expect(body.get('canvasWidth')).toBe('80');
		expect(body.get('canvasHeight')).toBe('80');
	});

	test('should not save without an initialized trench', async () => {
		const state = new TrenchProfileState();

		await state.savePosition('c1', 0, 0, 80, 80);

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('should toast an error when saving fails', async () => {
		const state = await initializedState();
		mockActionResponse({ type: 'failure', status: 500 });

		await state.savePosition('c1', 0, 0, 80, 80);

		expect(globalToaster.error).toHaveBeenCalled();
	});
});
