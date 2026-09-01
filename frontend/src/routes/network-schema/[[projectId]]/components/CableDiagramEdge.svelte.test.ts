import type { EdgeProps } from '@xyflow/svelte';
import type { SvelteFlowEdge } from '$lib/classes/NetworkSchemaState.svelte';
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { NetworkSchemaState } from '$lib/classes/NetworkSchemaState.svelte';

import CableDiagramEdgeFixture from './CableDiagramEdge.fixture.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_TILE_SERVER_URL: '' }
}));

vi.mock('@xyflow/svelte', async () => {
	const BaseEdge = (await import('$lib/test-utils/mocks/BaseEdge.svelte')).default;
	return {
		BaseEdge,
		getSmoothStepPath: () => ['M 0,0 L 100,100'],
		useSvelteFlow: () => ({
			screenToFlowPosition: (p: { x: number; y: number }) => p
		})
	};
});

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/network-schema/1') }
}));

vi.mock('devalue', () => ({
	parse: vi.fn((value: unknown) => value)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn()
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: Record<string, unknown>) =>
				params ? `${prop}:${JSON.stringify(params)}` : `${prop}`
		}
	)
}));

const fetchMock = vi.fn();

/**
 * Builds minimal edge props with a single draggable vertex at (100, 100).
 */
function buildProps(diagramPath: { x: number; y: number }[]) {
	return {
		id: 'cab-1',
		sourceX: 0,
		sourceY: 0,
		targetX: 400,
		targetY: 400,
		sourcePosition: 'bottom',
		targetPosition: 'top',
		selected: false,
		data: {
			label: 'K-Nord',
			cable: { uuid: 'cab-1', name: 'K-Nord', diagram_path: diagramPath },
			labelData: null
		}
	} as unknown as EdgeProps & { data: Record<string, unknown> };
}

/**
 * A NetworkSchemaState seeded with the single edge under test, so the real
 * drag-buffer and path methods run while we spy on saveCablePath.
 */
function seededState(diagramPath: { x: number; y: number }[]): NetworkSchemaState {
	const state = new NetworkSchemaState();
	// The canvas defaults to locked; vertex editing requires an unlocked canvas.
	state.locked = false;
	state.edges = [
		{
			id: 'cab-1',
			source: 'node-1',
			target: 'node-2',
			type: 'cableDiagramEdge',
			data: {
				label: 'K-Nord',
				cable: { uuid: 'cab-1', name: 'K-Nord', diagram_path: diagramPath }
			}
		} as unknown as SvelteFlowEdge
	];
	return state;
}

/**
 * Stubs the SVG geometry APIs jsdom does not implement so vertex dragging can
 * translate client coordinates 1:1 into SVG coordinates.
 */
function stubSvgGeometry(svg: SVGSVGElement) {
	Object.assign(svg, {
		createSVGPoint: () => {
			const point = {
				x: 0,
				y: 0,
				matrixTransform: () => ({ x: point.x, y: point.y })
			};
			return point;
		},
		getScreenCTM: () => ({ inverse: () => ({}) })
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({ type: 'success' })
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('CableDiagramEdge vertex handling', () => {
	test('should delete the vertex on Shift+MouseDown even when the Shift keydown was never observed', async () => {
		const schemaState = seededState([{ x: 100, y: 100 }]);
		const saveSpy = vi.spyOn(schemaState, 'saveCablePath').mockResolvedValue();

		const { container } = render(CableDiagramEdgeFixture, {
			edgeProps: buildProps([{ x: 100, y: 100 }]),
			schemaState
		});

		const vertex = container.querySelector('circle.nopan')!;

		// No keyboard events fired: Shift was pressed while focus was
		// elsewhere, so only the mouse event itself carries the modifier.
		await fireEvent.mouseDown(vertex, { shiftKey: true });

		expect(saveSpy).toHaveBeenCalledWith('cab-1', []);
	});

	test('should persist the dragged waypoints on mouseup, not the pre-drag path from props', async () => {
		const schemaState = seededState([{ x: 100, y: 100 }]);
		const saveSpy = vi.spyOn(schemaState, 'saveCablePath').mockResolvedValue();

		const { container } = render(CableDiagramEdgeFixture, {
			edgeProps: buildProps([{ x: 100, y: 100 }]),
			schemaState
		});

		stubSvgGeometry(container.querySelector('svg')!);
		const vertex = container.querySelector('circle.nopan')!;

		await fireEvent.mouseDown(vertex);
		await fireEvent.mouseMove(window, { clientX: 300, clientY: 300 });
		// Props are not updated by any parent here, mirroring the in-flight
		// moment before the temporary update has round-tripped through state.
		await fireEvent.mouseUp(window);

		// endPathDrag saves the buffered waypoint, not the stale prop path.
		expect(saveSpy).toHaveBeenCalledWith('cab-1', [{ x: 300, y: 300 }]);
	});
});

describe('CableDiagramEdge locking', () => {
	test('should not render vertex handles while the canvas is locked', () => {
		const schemaState = seededState([{ x: 100, y: 100 }]);
		schemaState.locked = true;

		const { container } = render(CableDiagramEdgeFixture, {
			edgeProps: buildProps([{ x: 100, y: 100 }]),
			schemaState
		});

		expect(container.querySelector('circle.nopan')).toBeNull();
	});

	test('should not add a vertex on edge click while the canvas is locked', async () => {
		const schemaState = seededState([]);
		schemaState.locked = true;
		const updateSpy = vi.spyOn(schemaState, 'updateCablePathWaypoints');

		const { container } = render(CableDiagramEdgeFixture, {
			edgeProps: buildProps([]),
			schemaState
		});

		stubSvgGeometry(container.querySelector('svg')!);
		const edgeGroup = container.querySelector('g')!;
		await fireEvent.click(edgeGroup);

		expect(updateSpy).not.toHaveBeenCalled();
	});

	test('should add a vertex on edge click when the canvas is unlocked', async () => {
		const schemaState = seededState([]);
		const updateSpy = vi.spyOn(schemaState, 'updateCablePathWaypoints');

		const { container } = render(CableDiagramEdgeFixture, {
			edgeProps: buildProps([]),
			schemaState
		});

		stubSvgGeometry(container.querySelector('svg')!);
		const edgeGroup = container.querySelector('g')!;
		await fireEvent.click(edgeGroup);

		expect(updateSpy).toHaveBeenCalled();
	});
});
