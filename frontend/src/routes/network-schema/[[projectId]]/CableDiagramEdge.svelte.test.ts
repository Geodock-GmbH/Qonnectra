import type { EdgeProps } from '@xyflow/svelte';
import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import CableDiagramEdgeTestHarness from './CableDiagramEdgeTestHarness.svelte';

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

/**
 * Collects updateCablePath events dispatched on window during a test.
 */
function collectPathEvents() {
	const events: { edgeId: string; waypoints: { x: number; y: number }[]; save?: boolean }[] = [];
	const listener = (event: Event) =>
		events.push((event as CustomEvent<(typeof events)[number]>).detail);
	window.addEventListener('updateCablePath', listener);
	return {
		events,
		cleanup: () => window.removeEventListener('updateCablePath', listener)
	};
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('CableDiagramEdge vertex handling', () => {
	test('should delete the vertex on Shift+MouseDown even when the Shift keydown was never observed', async () => {
		const { events, cleanup } = collectPathEvents();
		const { container } = render(CableDiagramEdgeTestHarness, {
			edgeProps: buildProps([{ x: 100, y: 100 }])
		});

		const vertex = container.querySelector('circle.nopan')!;

		// No keyboard events fired: Shift was pressed while focus was
		// elsewhere, so only the mouse event itself carries the modifier.
		await fireEvent.mouseDown(vertex, { shiftKey: true });

		cleanup();
		const saveEvent = events.find((e) => e.save);
		expect(saveEvent).toBeTruthy();
		expect(saveEvent!.waypoints).toEqual([]);
	});

	test('should persist the dragged waypoints on mouseup, not the pre-drag path from props', async () => {
		const { events, cleanup } = collectPathEvents();
		const { container } = render(CableDiagramEdgeTestHarness, {
			edgeProps: buildProps([{ x: 100, y: 100 }])
		});

		stubSvgGeometry(container.querySelector('svg')!);
		const vertex = container.querySelector('circle.nopan')!;

		await fireEvent.mouseDown(vertex);
		await fireEvent.mouseMove(window, { clientX: 300, clientY: 300 });
		// Props are not updated by any parent here, mirroring the in-flight
		// moment before the temporary update has round-tripped through state.
		await fireEvent.mouseUp(window);

		cleanup();
		const saveEvent = events.find((e) => e.save);
		expect(saveEvent).toBeTruthy();
		expect(saveEvent!.waypoints).toEqual([{ x: 300, y: 300 }]);
	});
});
