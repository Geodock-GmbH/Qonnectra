import { replaceState } from '$app/navigation';
import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getLayerExtent } from '$lib/remote/map/layers.remote';

import Map from './Map.svelte';

const { maps, views, pageState } = vi.hoisted(() => ({
	maps: [] as Array<{ on: ReturnType<typeof vi.fn>; options: Record<string, unknown> }>,
	views: [] as Array<{
		options: { center: number[]; zoom: number };
		animate: ReturnType<typeof vi.fn>;
	}>,
	pageState: { url: new URL('http://localhost/project/5/map'), state: {} }
}));

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }));

vi.mock('$app/state', () => ({ page: pageState }));

vi.mock('$env/dynamic/public', () => ({ env: {} }));

vi.mock('$lib/remote/map/layers.remote', () => ({
	getLayerExtent: vi.fn(async () => ({ extent: null, layer: 'trench' }))
}));

vi.mock('$lib/map/tileLoadingManager.js', () => ({
	tileLoadingManager: { resume: vi.fn(), cancelAllRequests: vi.fn() }
}));

vi.mock('$lib/map/workerPool', () => ({
	getWorkerPool: () => ({ cancelAllRequests: vi.fn() })
}));

vi.mock('ol/View', () => ({
	default: class FakeView {
		options: { center: number[]; zoom: number };
		animate = vi.fn();
		constructor(options: { center: number[]; zoom: number }) {
			this.options = options;
			views.push(this);
		}
		getCenter() {
			return this.options.center;
		}
		getZoom() {
			return this.options.zoom;
		}
	}
}));

vi.mock('ol/Map', () => ({
	default: class FakeMap {
		options: Record<string, unknown>;
		on = vi.fn();
		setTarget = vi.fn();
		removeLayer = vi.fn();
		constructor(options: Record<string, unknown>) {
			this.options = options;
			maps.push(this);
		}
		getView() {
			return this.options.view;
		}
		getViewport() {
			return { style: {} };
		}
		getLayers() {
			return { forEach: () => {}, insertAt: () => {}, getArray: () => [] };
		}
	}
}));

vi.mock('ol/control', () => ({ defaults: () => ({ extend: () => [] }) }));
vi.mock('ol/control/Zoom', () => ({ default: class {} }));
vi.mock('ol/layer/Tile', () => ({
	default: class {
		set() {}
		setOpacity() {}
	}
}));
vi.mock('ol/source/OSM', () => ({ default: class {} }));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const quiet = {
	showLayerVisibilityTree: false,
	showSearchPanel: false,
	showContextMenu: false,
	showOpacitySlider: false
};

/** Fires the map's `moveend` listener as OpenLayers would after a pan. */
function fireMoveEnd() {
	const listener = maps[0].on.mock.calls.find(([type]) => type === 'moveend')?.[1];
	listener();
}

beforeEach(() => {
	localStorage.clear();
	pageState.url = new URL('http://localhost/project/5/map');
});

afterEach(() => {
	maps.length = 0;
	views.length = 0;
	vi.mocked(replaceState).mockClear();
	vi.mocked(getLayerExtent).mockClear();
});

describe('Map view source', () => {
	test('should open on the hash view, ignoring the remembered view', async () => {
		localStorage.setItem('mapView:5', JSON.stringify({ zoom: 10, center: [1, 2] }));
		pageState.url = new URL('http://localhost/project/5/map#map=17.2/918200/6647800');

		render(Map, { ...quiet, projectId: '5', viewInUrl: true });

		await vi.waitFor(() => expect(views).toHaveLength(1));
		expect(views[0].options.center).toEqual([918200, 6647800]);
		expect(views[0].options.zoom).toBe(17.2);
		expect(getLayerExtent).not.toHaveBeenCalled();
	});

	test('should open on the remembered view of the project without a hash', async () => {
		localStorage.setItem('mapView:5', JSON.stringify({ zoom: 10, center: [1, 2] }));

		render(Map, { ...quiet, projectId: '5', viewInUrl: true });

		await vi.waitFor(() => expect(views).toHaveLength(1));
		expect(views[0].options.center).toEqual([1, 2]);
		expect(views[0].options.zoom).toBe(10);
	});

	test('should ignore the hash for a map that keeps its view out of the URL', async () => {
		localStorage.setItem('mapView:5', JSON.stringify({ zoom: 10, center: [1, 2] }));
		pageState.url = new URL('http://localhost/project/5/map#map=17/9/9');

		render(Map, { ...quiet, projectId: '5' });

		await vi.waitFor(() => expect(views).toHaveLength(1));
		expect(views[0].options.center).toEqual([1, 2]);
	});

	test('should fit the project extent for a project never visited', async () => {
		render(Map, { ...quiet, projectId: '5', viewInUrl: true });

		await vi.waitFor(() =>
			expect(getLayerExtent).toHaveBeenCalledWith({ layerType: 'trench', projectId: '5' })
		);
		expect(views[0].options.center).toEqual([0, 0]);
		expect(views[0].options.zoom).toBe(2);
	});
});

describe('Map view writes', () => {
	test('should write the view to the hash without a navigation, and remember it per project', async () => {
		render(Map, { ...quiet, projectId: '5', viewInUrl: true });
		await vi.waitFor(() => expect(maps).toHaveLength(1));
		views[0].options = { center: [918200.4, 6647800.6], zoom: 15.44 };

		fireMoveEnd();

		expect(JSON.parse(localStorage.getItem('mapView:5') ?? 'null')).toEqual({
			zoom: 15.44,
			center: [918200.4, 6647800.6]
		});
		await vi.waitFor(() => expect(replaceState).toHaveBeenCalledOnce());
		const [url] = vi.mocked(replaceState).mock.calls[0];
		expect(String(url)).toBe('http://localhost/project/5/map#map=15.4/918200/6647801');
	});

	test('should leave the URL alone for a map that keeps its view out of the URL', async () => {
		render(Map, { ...quiet, projectId: '5' });
		await vi.waitFor(() => expect(maps).toHaveLength(1));

		fireMoveEnd();

		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(replaceState).not.toHaveBeenCalled();
	});
});

describe('Map following the hash', () => {
	test('should move to a hash the user changed and stay for its own hash', async () => {
		render(Map, { ...quiet, projectId: '5', viewInUrl: true });
		await vi.waitFor(() => expect(maps).toHaveLength(1));
		views[0].options = { center: [100, 200], zoom: 12 };

		location.hash = '#map=12/100/200';
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		expect(views[0].animate).not.toHaveBeenCalled();

		location.hash = '#map=14/300/400';
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		expect(views[0].animate).toHaveBeenCalledWith({ center: [300, 400], zoom: 14, duration: 300 });
	});
});
