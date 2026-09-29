import { render } from '@testing-library/svelte';
import { apply } from 'ol-mapbox-style';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { basemapTheme } from '$lib/stores/store';

import Map from './Map.svelte';

vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/project/5/map'), state: {} }
}));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_TILE_SERVER_URL: 'http://tiles.test' }
}));

vi.mock('ol-mapbox-style', () => ({ apply: vi.fn(async () => {}) }));

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
		constructor(options: { center: number[]; zoom: number }) {
			this.options = options;
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
		}
		getView() {
			return this.options.view;
		}
		getViewport() {
			return { style: {} };
		}
		getLayers() {
			return { forEach: () => {}, insertAt: () => {}, clear: () => {}, push: () => {} };
		}
	}
}));

vi.mock('ol/control', () => ({ defaults: () => ({ extend: () => [] }) }));
vi.mock('ol/control/Zoom', () => ({ default: class {} }));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const quiet = {
	showLayerVisibilityTree: false,
	showSearchPanel: false,
	showContextMenu: false,
	showOpacitySlider: false
};

/**
 * @returns The style URLs the basemap was styled with, in order.
 */
function appliedStyles() {
	return vi.mocked(apply).mock.calls.map(([, style]) => style);
}

beforeEach(() => {
	localStorage.clear();
	basemapTheme.set('light');
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true }))
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(apply).mockClear();
});

describe('Map basemap theme', () => {
	test('should style the basemap once on mount, with the remembered theme', async () => {
		render(Map, { ...quiet, projectId: '5' });

		await vi.waitFor(() => expect(apply).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(appliedStyles()).toEqual(['http://tiles.test/styles/light/style.json']);
	});

	test('should restyle the basemap when the theme is switched', async () => {
		render(Map, { ...quiet, projectId: '5' });
		await vi.waitFor(() => expect(apply).toHaveBeenCalled());

		basemapTheme.set('dark');

		await vi.waitFor(() =>
			expect(appliedStyles()).toEqual([
				'http://tiles.test/styles/light/style.json',
				'http://tiles.test/styles/dark/style.json'
			])
		);
	});
});
