import type {
	CableData,
	CableType,
	EdgeLabelData,
	MicropipeConnection,
	MicropipeConnectionMap,
	NodeFeature,
	SvelteFlowEdge,
	SvelteFlowNode
} from './NetworkSchemaState.svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import { NetworkSchemaState } from './NetworkSchemaState.svelte';

// Node persistence runs through a remote-function command; mock the module so
// the class's call is observable without a running server.
const saveNodeGeometry = vi.fn();

vi.mock('$lib/remote/network-schema/nodes.remote', () => ({
	getNodeDetails: vi.fn().mockResolvedValue({}),
	saveNodeGeometry: (...args: unknown[]) => saveNodeGeometry(...args)
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

function makeNodeFeature(overrides: Partial<NodeFeature> = {}): NodeFeature {
	return {
		id: 'node-1',
		uuid: 'node-1',
		name: 'Node One',
		canvas_x: 10,
		canvas_y: 20,
		child_canvas_x: 100,
		child_canvas_y: 200,
		...overrides
	};
}

function makeCable(overrides: Partial<CableData> = {}): CableData {
	return {
		uuid: 'cable-1',
		name: 'Cable One',
		uuid_node_start: 'node-1',
		uuid_node_end: 'node-2',
		...overrides
	};
}

function makeCableTypes(): CableType[] {
	return [
		{ value: 'ct-1', label: 'Type A' },
		{ value: 'ct-2', label: 'Type B' }
	];
}

describe('NetworkSchemaState initialization & defaults', () => {
	test('constructs empty with sensible defaults when no data given', () => {
		const state = new NetworkSchemaState();

		expect(state.nodes).toEqual([]);
		expect(state.edges).toEqual([]);
		expect(state.cableTypes).toEqual([]);
		expect(state.userCableName).toBe('');
		expect(state.selectedCableType).toEqual([]);
		expect(state.parentNodeContext).toBeNull();
		expect(state.pendingMicroductChoices).toEqual([]);
		expect(state.isChildView).toBe(false);
		expect(state.initialized).toBe(false);
	});

	test('constructor initializes when passed initial data', () => {
		const state = new NetworkSchemaState({
			nodes: [makeNodeFeature()],
			cables: [makeCable()],
			cableMicropipeConnections: {},
			cableTypes: makeCableTypes()
		});

		expect(state.initialized).toBe(true);
		expect(state.nodes).toHaveLength(1);
		expect(state.nodes[0].id).toBe('node-1');
		expect(state.cableTypes).toHaveLength(2);
		// cable has both start/end nodes so it becomes an edge
		expect(state.edges).toHaveLength(1);
		expect(state.edges[0].id).toBe('cable-1');
	});

	test('initialize is idempotent - second call is ignored', () => {
		const state = new NetworkSchemaState();
		state.initialize({
			nodes: [makeNodeFeature()],
			cables: [],
			cableMicropipeConnections: {},
			cableTypes: makeCableTypes()
		});
		expect(state.initialized).toBe(true);
		expect(state.nodes).toHaveLength(1);

		// second call must not overwrite existing state
		state.initialize({
			nodes: [makeNodeFeature({ id: 'node-x', uuid: 'node-x' }), makeNodeFeature()],
			cables: [],
			cableMicropipeConnections: {},
			cableTypes: []
		});
		expect(state.nodes).toHaveLength(1);
		expect(state.cableTypes).toHaveLength(2);
	});
});

describe('NetworkSchemaState.transformNodesToSvelteFlow', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
	});

	test('returns empty array for empty input', () => {
		expect(state.transformNodesToSvelteFlow([])).toEqual([]);
		expect(state.transformNodesToSvelteFlow({ features: [] })).toEqual([]);
		expect(state.transformNodesToSvelteFlow({})).toEqual([]);
	});

	test('uses canvas coordinates in parent view', () => {
		const [node] = state.transformNodesToSvelteFlow([makeNodeFeature()]);
		expect(node.position).toEqual({ x: 10, y: 20 });
		expect(node.type).toBe('cableDiagramNode');
		expect(node.selected).toBe(false);
		expect(node.data.label).toBe('Node One');
	});

	test('uses child canvas coordinates in child view', () => {
		state.isChildView = true;
		const [node] = state.transformNodesToSvelteFlow([makeNodeFeature()]);
		expect(node.position).toEqual({ x: 100, y: 200 });
	});

	test('falls back to scaled geometry when canvas coords are null', () => {
		const feature = makeNodeFeature({
			canvas_x: null,
			canvas_y: null,
			geometry: { coordinates: [50000, 100000] }
		});
		const [node] = state.transformNodesToSvelteFlow([feature]);
		expect(node.position.x).toBeCloseTo(5);
		expect(node.position.y).toBeCloseTo(-10);
	});

	test('reads coordinates from GeoJSON feature properties', () => {
		const feature: NodeFeature = {
			id: 'geo-1',
			properties: {
				uuid: 'geo-1',
				name: 'Geo Node',
				canvas_x: 3,
				canvas_y: 4,
				child_canvas_x: null,
				child_canvas_y: null
			}
		};
		const [node] = state.transformNodesToSvelteFlow({ features: [feature] });
		expect(node.id).toBe('geo-1');
		expect(node.position).toEqual({ x: 3, y: 4 });
		expect(node.data.label).toBe('Geo Node');
	});

	test('falls back to unnamed label when node has no name', () => {
		const [node] = state.transformNodesToSvelteFlow([makeNodeFeature({ name: undefined })]);
		expect(node.data.label).toBe('form_unnamed_node');
	});
});

describe('NetworkSchemaState.transformCablesToSvelteFlowEdges', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
	});

	test('returns empty array for empty input', () => {
		expect(state.transformCablesToSvelteFlowEdges([])).toEqual([]);
		expect(state.transformCablesToSvelteFlowEdges(null as unknown as CableData[])).toEqual([]);
	});

	test('drops cables missing a start or end node', () => {
		const edges = state.transformCablesToSvelteFlowEdges([
			makeCable(),
			makeCable({ uuid: 'cable-2', uuid_node_end: '' }),
			makeCable({ uuid: 'cable-3', uuid_node_start: '' })
		]);
		expect(edges).toHaveLength(1);
		expect(edges[0].id).toBe('cable-1');
	});

	test('builds handle ids and preserves source/target', () => {
		const [edge] = state.transformCablesToSvelteFlowEdges([
			makeCable({ handle_start: 'left', handle_end: 'right' })
		]);
		expect(edge.source).toBe('node-1');
		expect(edge.target).toBe('node-2');
		expect(edge.sourceHandle).toBe('node-1-left-source');
		expect(edge.targetHandle).toBe('node-2-right-target');
		expect(edge.type).toBe('cableDiagramEdge');
	});

	test('leaves handles undefined when cable has none', () => {
		const [edge] = state.transformCablesToSvelteFlowEdges([makeCable()]);
		expect(edge.sourceHandle).toBeUndefined();
		expect(edge.targetHandle).toBeUndefined();
	});

	test('sorts micropipe connections and derives lowest + isConnected', () => {
		const connections: MicropipeConnection[] = [
			{ number: 5, color_hex: '#0000ff', color_name: 'blau' },
			{ number: 2, color_hex: '#ff0000', color_name: 'rot' }
		];
		const map: MicropipeConnectionMap = { 'cable-1': connections };
		const [edge] = state.transformCablesToSvelteFlowEdges([makeCable()], map);
		expect(edge.data.isConnected).toBe(true);
		expect(edge.data.lowestMicropipe?.number).toBe(2);
		expect(edge.data.micropipeConnections).toEqual(connections);
	});

	test('marks edges without connections as not connected', () => {
		const [edge] = state.transformCablesToSvelteFlowEdges([makeCable()]);
		expect(edge.data.isConnected).toBe(false);
		expect(edge.data.lowestMicropipe).toBeNull();
	});

	test('prefers labelData text over cable name for the label', () => {
		const labelData: EdgeLabelData = {
			position_x: 1,
			position_y: 2,
			text: 'Custom Label',
			uuid: 'lbl-1'
		};
		const [edge] = state.transformCablesToSvelteFlowEdges([makeCable({ labelData })]);
		expect(edge.data.label).toBe('Custom Label');
	});
});

describe('NetworkSchemaState selection', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
		state.nodes = [
			{ id: 'n1', selected: false } as SvelteFlowNode,
			{ id: 'n2', selected: true } as SvelteFlowNode
		];
		state.edges = [
			{ id: 'e1', selected: false } as SvelteFlowEdge,
			{ id: 'e2', selected: true } as SvelteFlowEdge
		];
	});

	test('selectNode selects the target and deselects the rest', () => {
		state.selectNode('n1');
		expect(state.nodes.find((n) => n.id === 'n1')?.selected).toBe(true);
		expect(state.nodes.find((n) => n.id === 'n2')?.selected).toBe(false);
	});

	test('selectNode with unknown id deselects everything', () => {
		state.selectNode('does-not-exist');
		expect(state.nodes.every((n) => !n.selected)).toBe(true);
	});

	test('deselectAllNodes clears all node selection', () => {
		state.deselectAllNodes();
		expect(state.nodes.every((n) => !n.selected)).toBe(true);
	});

	test('selectEdge selects the target and deselects the rest', () => {
		state.selectEdge('e1');
		expect(state.edges.find((e) => e.id === 'e1')?.selected).toBe(true);
		expect(state.edges.find((e) => e.id === 'e2')?.selected).toBe(false);
	});

	test('deselectAllEdges clears all edge selection', () => {
		state.deselectAllEdges();
		expect(state.edges.every((e) => !e.selected)).toBe(true);
	});
});

describe('NetworkSchemaState deletion', () => {
	let state: NetworkSchemaState;
	let dispatchSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		state = new NetworkSchemaState();
		dispatchSpy = vi.spyOn(window, 'dispatchEvent');
	});

	test('handleEdgeDelete removes edge and dispatches change event with node ids', () => {
		state.edges = [
			{ id: 'e1', source: 'a', target: 'b' } as SvelteFlowEdge,
			{ id: 'e2', source: 'c', target: 'd' } as SvelteFlowEdge
		];
		state.handleEdgeDelete('e1');

		expect(state.edges.map((e) => e.id)).toEqual(['e2']);
		expect(dispatchSpy).toHaveBeenCalledTimes(1);
		const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
		expect(event.type).toBe('cableConnectionChanged');
		expect(event.detail.nodeIds).toEqual(['a', 'b']);
	});

	test('handleEdgeDelete on unknown id does not dispatch', () => {
		state.edges = [{ id: 'e1', source: 'a', target: 'b' } as SvelteFlowEdge];
		state.handleEdgeDelete('missing');
		expect(state.edges).toHaveLength(1);
		expect(dispatchSpy).not.toHaveBeenCalled();
	});

	test('handleNodeDelete removes node and all connected edges', () => {
		state.nodes = [{ id: 'n1' } as SvelteFlowNode, { id: 'n2' } as SvelteFlowNode];
		state.edges = [
			{ id: 'e1', source: 'n1', target: 'n2' } as SvelteFlowEdge,
			{ id: 'e2', source: 'n2', target: 'n3' } as SvelteFlowEdge,
			{ id: 'e3', source: 'n4', target: 'n1' } as SvelteFlowEdge
		];
		state.handleNodeDelete('n1');

		expect(state.nodes.map((n) => n.id)).toEqual(['n2']);
		// e1 (source n1) and e3 (target n1) removed, e2 kept
		expect(state.edges.map((e) => e.id)).toEqual(['e2']);
	});
});

describe('NetworkSchemaState update helpers', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
	});

	test('updateEdge merges shallow updates into the matched edge only', () => {
		state.edges = [
			{ id: 'e1', source: 'a', selected: false } as SvelteFlowEdge,
			{ id: 'e2', source: 'b', selected: false } as SvelteFlowEdge
		];
		state.updateEdge('e1', { selected: true });
		expect(state.edges.find((e) => e.id === 'e1')?.selected).toBe(true);
		expect(state.edges.find((e) => e.id === 'e2')?.selected).toBe(false);
	});

	test('updateNodeName updates label and nested node name', () => {
		state.nodes = [
			{
				id: 'n1',
				data: { label: 'Old', node: { name: 'Old' } }
			} as unknown as SvelteFlowNode
		];
		state.updateNodeName('n1', 'New Name');
		const node = state.nodes[0];
		expect(node.data.label).toBe('New Name');
		expect((node.data.node as { name: string }).name).toBe('New Name');
	});

	test('updateNodeName leaves other nodes untouched', () => {
		state.nodes = [
			{ id: 'n1', data: { label: 'A', node: { name: 'A' } } } as unknown as SvelteFlowNode,
			{ id: 'n2', data: { label: 'B', node: { name: 'B' } } } as unknown as SvelteFlowNode
		];
		state.updateNodeName('n1', 'Changed');
		expect(state.nodes[1].data.label).toBe('B');
	});

	test('updateEdgeName updates label, cable name and syncs labelData text', () => {
		state.edges = [
			{
				id: 'e1',
				data: {
					label: 'Old',
					cable: { name: 'Old' },
					labelData: { text: 'Old', position_x: 0, position_y: 0, uuid: 'l1' }
				}
			} as unknown as SvelteFlowEdge
		];
		state.updateEdgeName('e1', 'Renamed');
		const edge = state.edges[0];
		expect(edge.data.label).toBe('Renamed');
		expect(edge.data.cable.name).toBe('Renamed');
		expect(edge.data.labelData?.text).toBe('Renamed');
	});

	test('updateEdgeName leaves labelData null when there was none', () => {
		state.edges = [
			{
				id: 'e1',
				data: { label: 'Old', cable: { name: 'Old' }, labelData: null }
			} as unknown as SvelteFlowEdge
		];
		state.updateEdgeName('e1', 'Renamed');
		expect(state.edges[0].data.labelData).toBeNull();
	});

	test('updateEdgeLabelData sets the labelData on the matched edge', () => {
		state.edges = [{ id: 'e1', data: { label: 'x' } } as unknown as SvelteFlowEdge];
		const labelData: EdgeLabelData = {
			position_x: 5,
			position_y: 6,
			text: 'Label',
			uuid: 'l1'
		};
		state.updateEdgeLabelData('e1', labelData);
		expect(state.edges[0].data.labelData).toEqual(labelData);
	});

	test('updateEdgeMicropipeConnections sorts, sets lowest and isConnected', () => {
		state.edges = [{ id: 'e1', data: { label: 'x' } } as unknown as SvelteFlowEdge];
		state.updateEdgeMicropipeConnections('e1', [
			{ number: 7, color_hex: '#0000ff', color_name: 'blau' },
			{ number: 1, color_hex: '#ff0000', color_name: 'rot' }
		]);
		const data = state.edges[0].data;
		expect(data.lowestMicropipe?.number).toBe(1);
		expect(data.isConnected).toBe(true);
		expect(data.micropipeConnections).toHaveLength(2);
	});

	test('updateEdgeMicropipeConnections with empty array marks not connected', () => {
		state.edges = [{ id: 'e1', data: { label: 'x' } } as unknown as SvelteFlowEdge];
		state.updateEdgeMicropipeConnections('e1', []);
		expect(state.edges[0].data.isConnected).toBe(false);
		expect(state.edges[0].data.lowestMicropipe).toBeNull();
	});
});

describe('NetworkSchemaState.updateCableHandles', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
		state.edges = [
			{
				id: 'cable-1',
				source: 'node-1',
				target: 'node-2',
				data: { cable: { handle_start: '', handle_end: '' } }
			} as unknown as SvelteFlowEdge
		];
	});

	test('rebuilds handle ids and stores handles on the cable', () => {
		state.updateCableHandles('cable-1', 'top', 'bottom');
		const edge = state.edges[0];
		expect(edge.sourceHandle).toBe('node-1-top-source');
		expect(edge.targetHandle).toBe('node-2-bottom-target');
		expect(edge.data.cable.handle_start).toBe('top');
		expect(edge.data.cable.handle_end).toBe('bottom');
	});

	test('logs error and leaves state unchanged for unknown cable', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const before = state.edges;
		state.updateCableHandles('missing', 'top', 'bottom');
		expect(errorSpy).toHaveBeenCalled();
		expect(state.edges).toBe(before);
		errorSpy.mockRestore();
	});
});

describe('NetworkSchemaState.updateEdgeConnection', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
		state.edges = [
			{
				id: 'cable-1',
				source: 'node-1',
				target: 'node-2',
				data: {
					cable: {
						uuid_node_start: 'node-1',
						uuid_node_end: 'node-2',
						handle_start: 'a',
						handle_end: 'b'
					}
				}
			} as unknown as SvelteFlowEdge
		];
	});

	test('rewires the start side to a new node', () => {
		state.updateEdgeConnection('cable-1', 'start', 'node-9', 'left');
		const edge = state.edges[0];
		expect(edge.source).toBe('node-9');
		expect(edge.sourceHandle).toBe('node-9-left-source');
		expect(edge.data.cable.uuid_node_start).toBe('node-9');
		expect(edge.data.cable.handle_start).toBe('left');
		// end side untouched
		expect(edge.target).toBe('node-2');
	});

	test('rewires the end side to a new node', () => {
		state.updateEdgeConnection('cable-1', 'end', 'node-9', 'right');
		const edge = state.edges[0];
		expect(edge.target).toBe('node-9');
		expect(edge.targetHandle).toBe('node-9-right-target');
		expect(edge.data.cable.uuid_node_end).toBe('node-9');
		expect(edge.data.cable.handle_end).toBe('right');
		expect(edge.source).toBe('node-1');
	});
});

describe('NetworkSchemaState pure helpers', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
	});

	test('generateRandomString honors length and uses the allowed alphabet', () => {
		const s = state.generateRandomString(16);
		expect(s).toHaveLength(16);
		expect(s).toMatch(/^[A-Za-z0-9]+$/);
		expect(state.generateRandomString()).toHaveLength(10);
	});

	test('parseHandlePosition extracts the position segment', () => {
		expect(state.parseHandlePosition('node-1-left-source')).toBe('left');
		expect(state.parseHandlePosition('node-uuid-top-target')).toBe('top');
	});

	test('parseHandlePosition returns null for undefined', () => {
		expect(state.parseHandlePosition(undefined)).toBeNull();
	});

	test('formatMicroductLabel builds a readable label', () => {
		expect(
			state.formatMicroductLabel({
				microduct_uuid: 'm1',
				number: 4,
				color: 'blau',
				color_hex: '#00f',
				conduit_uuid: 'c1',
				conduit_name: 'Conduit-A',
				node_name: null,
				linked_cables: []
			})
		).toBe('Conduit-A #4 blau');
	});

	test('formatMicroductLabel returns empty string for null', () => {
		expect(state.formatMicroductLabel(null)).toBe('');
	});
});

describe('NetworkSchemaState.handleNodeDragStop', () => {
	let state: NetworkSchemaState;
	beforeEach(() => {
		state = new NetworkSchemaState();
		state.nodes = [{ id: 'n1', position: { x: 1, y: 2 } } as SvelteFlowNode];
		vi.clearAllMocks();
		saveNodeGeometry.mockResolvedValue({});
	});

	test('returns early when the dragged node is unknown', async () => {
		await state.handleNodeDragStop({
			targetNode: { id: 'unknown', position: { x: 5, y: 5 } }
		});
		expect(saveNodeGeometry).not.toHaveBeenCalled();
	});

	test('persists new coordinates and toasts success', async () => {
		await state.handleNodeDragStop({
			targetNode: { id: 'n1', position: { x: 42, y: 84 } }
		});

		expect(saveNodeGeometry).toHaveBeenCalledTimes(1);
		expect(saveNodeGeometry).toHaveBeenCalledWith({
			nodeId: 'n1',
			x: 42,
			y: 84,
			isChildView: false
		});
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('persists child coordinates in child view', async () => {
		state.isChildView = true;

		await state.handleNodeDragStop({
			targetNode: { id: 'n1', position: { x: 7, y: 8 } }
		});

		expect(saveNodeGeometry).toHaveBeenCalledWith({
			nodeId: 'n1',
			x: 7,
			y: 8,
			isChildView: true
		});
	});

	test('reverts position and toasts error when the save fails', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		saveNodeGeometry.mockRejectedValue(new Error('boom'));

		await state.handleNodeDragStop({
			targetNode: { id: 'n1', position: { x: 99, y: 99 } }
		});

		expect(state.nodes[0].position).toEqual({ x: 1, y: 2 });
		expect(globalToaster.error).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
