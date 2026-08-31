import type { CableData, EdgeLabelData, SvelteFlowEdge } from './NetworkSchemaState.svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { fireBeforeUnload } from '$lib/test-utils/fireBeforeUnload';

import { NetworkSchemaState } from './NetworkSchemaState.svelte';

// Path/label persistence runs through remote-function commands; mock the
// modules so the class's calls are observable without a running server.
const saveCableGeometry = vi.fn();
const upsertCableLabel = vi.fn();
const deleteCableLabel = vi.fn();
const getCableDetails = vi.fn();
const getNodeDetails = vi.fn();

vi.mock('$lib/remote/network-schema/paths.remote', () => ({
	saveCableGeometry: (...args: unknown[]) => saveCableGeometry(...args)
}));
vi.mock('$lib/remote/network-schema/labels.remote', () => ({
	upsertCableLabel: (...args: unknown[]) => upsertCableLabel(...args),
	deleteCableLabel: (...args: unknown[]) => deleteCableLabel(...args)
}));
vi.mock('$lib/remote/network-schema/cables.remote', () => ({
	getCableDetails: (...args: unknown[]) => getCableDetails(...args)
}));
vi.mock('$lib/remote/network-schema/nodes.remote', () => ({
	getNodeDetails: (...args: unknown[]) => getNodeDetails(...args)
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/network-schema/1') }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target: unknown, prop: string) => () => String(prop) })
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn()
}));

const waypoints = [
	{ x: 1, y: 2 },
	{ x: 3, y: 4 }
];

/**
 * Build a state instance seeded with a single edge for the given cable.
 */
function stateWithEdge(cableOverrides: Partial<CableData> = {}): NetworkSchemaState {
	const cable: CableData = {
		uuid: 'cable-1',
		name: 'Cable One',
		uuid_node_start: 'node-1',
		uuid_node_end: 'node-2',
		...cableOverrides
	};
	const state = new NetworkSchemaState();
	state.edges = [
		{
			id: 'cable-1',
			source: 'node-1',
			target: 'node-2',
			type: 'cableDiagramEdge',
			data: {
				label: cable.name,
				cable,
				labelData: cable.labelData ?? null
			}
		} as unknown as SvelteFlowEdge
	];
	return state;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	saveCableGeometry.mockResolvedValue({});
	upsertCableLabel.mockResolvedValue({ position_x: 0, position_y: 0, text: '', uuid: 'label-1' });
	deleteCableLabel.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	saveCableGeometry.mockReset();
	upsertCableLabel.mockReset();
	deleteCableLabel.mockReset();
	getCableDetails.mockReset();
	getNodeDetails.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('updateCablePathWaypoints', () => {
	test('updates the edge diagram path locally without persisting', () => {
		const state = stateWithEdge();

		state.updateCablePathWaypoints('cable-1', waypoints);

		expect(state.edges[0].data.cable.diagram_path).toEqual(waypoints);
		expect(saveCableGeometry).not.toHaveBeenCalled();
	});
});

describe('saveCablePath', () => {
	test('optimistically updates and persists the path, toasting success', async () => {
		const state = stateWithEdge();

		await state.saveCablePath('cable-1', waypoints);

		expect(saveCableGeometry).toHaveBeenCalledWith({ cableId: 'cable-1', diagramPath: waypoints });
		expect(state.edges[0].data.cable.diagram_path).toEqual(waypoints);
		expect(globalToaster.success).toHaveBeenCalled();
		expect(globalToaster.error).not.toHaveBeenCalled();
	});

	test('rolls back and toasts an error when the command rejects', async () => {
		saveCableGeometry.mockRejectedValue(new Error('nope'));
		const state = stateWithEdge({ diagram_path: [{ x: 9, y: 9 }] });

		await state.saveCablePath('cable-1', waypoints);

		expect(state.edges[0].data.cable.diagram_path).toEqual([{ x: 9, y: 9 }]);
		expect(globalToaster.error).toHaveBeenCalled();
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('toasts an error on network failures', async () => {
		saveCableGeometry.mockRejectedValue(new Error('offline'));
		const state = stateWithEdge();

		await state.saveCablePath('cable-1', waypoints);

		expect(globalToaster.error).toHaveBeenCalled();
	});

	test('blocks unload while the save request is in flight', async () => {
		let resolveSave!: (value: unknown) => void;
		saveCableGeometry.mockReturnValue(new Promise((resolve) => (resolveSave = resolve)));

		const state = stateWithEdge();
		const pending = state.saveCablePath('cable-1', waypoints);

		expect(fireBeforeUnload()).toBe(true);

		resolveSave({});
		await pending;

		expect(fireBeforeUnload()).toBe(false);
	});
});

describe('path drag buffer', () => {
	test('endPathDrag persists the buffered waypoints, not stale props', async () => {
		const state = stateWithEdge({ diagram_path: [{ x: 0, y: 0 }] });

		state.beginPathDrag('cable-1');
		state.dragPathVertex('cable-1', 0, { x: 5, y: 6 });
		await state.endPathDrag('cable-1');

		expect(saveCableGeometry).toHaveBeenCalledWith({
			cableId: 'cable-1',
			diagramPath: [{ x: 5, y: 6 }]
		});
		expect(state.edges[0].data.cable.diagram_path).toEqual([{ x: 5, y: 6 }]);
	});
});

describe('resetLabel', () => {
	const label: EdgeLabelData = { position_x: 1, position_y: 2, text: 'L', uuid: 'label-1' };

	test('optimistically clears the label and returns true on success', async () => {
		const state = stateWithEdge({ labelData: label });

		const ok = await state.resetLabel('cable-1', 'label-1');

		expect(ok).toBe(true);
		expect(state.edges[0].data.labelData).toBeNull();
		expect(deleteCableLabel).toHaveBeenCalledWith({ labelId: 'label-1' });
	});

	test('rolls the label back and returns false on failure', async () => {
		deleteCableLabel.mockRejectedValue(new Error('nope'));
		const state = stateWithEdge({ labelData: label });

		const ok = await state.resetLabel('cable-1', 'label-1');

		expect(ok).toBe(false);
		expect(state.edges[0].data.labelData).toEqual(label);
		expect(globalToaster.error).toHaveBeenCalled();
	});
});

describe('saveLabelPosition', () => {
	test('persists the new position, updates state from the returned label, and returns true', async () => {
		const savedLabel: EdgeLabelData = {
			position_x: 42,
			position_y: 24,
			text: 'Cable One',
			uuid: 'label-1'
		};
		upsertCableLabel.mockResolvedValue(savedLabel);
		const state = stateWithEdge();

		const ok = await state.saveLabelPosition('cable-1', { x: 42, y: 24 });

		expect(ok).toBe(true);
		expect(state.edges[0].data.labelData).toEqual(savedLabel);
		expect(upsertCableLabel).toHaveBeenCalledWith(
			expect.objectContaining({ cableId: 'cable-1', positionX: 42, positionY: 24 })
		);
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('rolls back and returns false when the command rejects', async () => {
		const original: EdgeLabelData = {
			position_x: 1,
			position_y: 2,
			text: 'L',
			uuid: 'label-1'
		};
		upsertCableLabel.mockRejectedValue(new Error('nope'));
		const state = stateWithEdge({ labelData: original });

		const ok = await state.saveLabelPosition('cable-1', { x: 42, y: 24, labelId: 'label-1' });

		expect(ok).toBe(false);
		expect(state.edges[0].data.labelData).toEqual(original);
		expect(globalToaster.error).toHaveBeenCalled();
	});
});
