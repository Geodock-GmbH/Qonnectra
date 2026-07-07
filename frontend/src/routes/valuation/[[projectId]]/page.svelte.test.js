import { tick } from 'svelte';
import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './+page.svelte';

const {
	mockReinitializeForProject,
	mockReinitializeForGlobalView,
	mockMapStateCtorCapture,
	mockStores
} = vi.hoisted(() => ({
	mockReinitializeForProject: vi.fn(),
	mockReinitializeForGlobalView: vi.fn(),
	mockMapStateCtorCapture: { args: /** @type {any[]} */ ([]) },
	mockStores: {
		selectedProject: /** @type {any} */ (null),
		globalMapView: /** @type {any} */ (null)
	}
}));

vi.mock('$lib/classes/MapState.svelte.js', () => {
	class MockMapState {
		constructor(/** @type {any[]} */ ...args) {
			mockMapStateCtorCapture.args = args;
			this.selectedProject = args[0];
			this.isGlobalView = args[4] ?? false;
			this.olMap = null;
		}
		initializeLayers() {
			return true;
		}
		getLayers() {
			return [];
		}
		getLayerReferences() {
			return {
				vectorTileLayer: null,
				addressLayer: null,
				nodeLayer: null,
				areaLayer: null
			};
		}
		get reinitializeForProject() {
			return mockReinitializeForProject;
		}
		get reinitializeForGlobalView() {
			return mockReinitializeForGlobalView;
		}
		updateNodeLayerStyle() {}
		updateTrenchLayerStyle() {}
		updateAddressLayerStyle() {}
		updateAreaLayerStyle() {}
		updateLabelVisibility() {}
		refreshTileSources() {}
		cleanup() {}
	}
	return { MapState: MockMapState };
});

vi.mock('$lib/stores/store', () => {
	/**
	 * @param {any} initialValue
	 */
	const createStore = (initialValue = null) => {
		let value = initialValue;
		/** @type {Set<Function>} */
		const subscribers = new Set();
		return {
			subscribe: (/** @type {Function} */ callback) => {
				subscribers.add(callback);
				callback(value);
				return () => subscribers.delete(callback);
			},
			set: (/** @type {any} */ newValue) => {
				value = newValue;
				subscribers.forEach((/** @type {Function} */ cb) => cb(value));
			},
			update: (/** @type {Function} */ fn) => {
				value = fn(value);
				subscribers.forEach((/** @type {Function} */ cb) => cb(value));
			}
		};
	};

	mockStores.selectedProject = createStore('1');
	mockStores.globalMapView = createStore(false);

	return {
		selectedProject: mockStores.selectedProject,
		globalMapView: mockStores.globalMapView,
		trenchColor: createStore('#000000'),
		trenchColorSelected: createStore('#ff0000'),
		nodeTypeStyles: createStore({}),
		addressStyle: createStore({ color: '#000000', size: 8 }),
		areaTypeStyles: createStore({}),
		labelVisibilityConfig: createStore({}),
		trenchConstructionTypeStyles: createStore({}),
		trenchStyleMode: createStore('default'),
		trenchSurfaceStyles: createStore({})
	};
});

vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/state', () => ({
	page: {
		data: {
			srid: 25832,
			proj4Def: '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
		},
		params: { projectId: '1' },
		url: { pathname: '/valuation/1' }
	}
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn()
}));

vi.mock('$lib/paraglide/messages', () => {
	const mockMessages = new Proxy(
		{},
		{
			get: (/** @type {any} */ _target, /** @type {string} */ prop) => {
				return () => String(prop);
			}
		}
	);
	return { m: mockMessages };
});

vi.mock('ol/format/GeoJSON.js', () => ({
	default: class GeoJSON {
		readFeature() {
			return { getGeometry: () => ({ getExtent: () => [0, 0, 1, 1] }) };
		}
	}
}));

vi.mock('ol/layer/Vector.js', () => ({
	default: class VectorLayer {
		/** @param {any} options */
		constructor(options) {
			this.options = options;
			this.source = options?.source;
		}
		getSource() {
			return { addFeature: vi.fn(), removeFeature: vi.fn(), clear: vi.fn(), dispose: vi.fn() };
		}
		changed() {}
	}
}));

vi.mock('ol/source/Vector.js', () => ({
	default: class VectorSource {
		constructor() {}
		addFeature() {}
		removeFeature() {}
		clear() {}
	}
}));

vi.mock('ol/style.js', () => ({
	Fill: class Fill {
		/** @param {any} opts */
		constructor(opts) {
			this.opts = opts;
		}
	},
	Stroke: class Stroke {
		/** @param {any} opts */
		constructor(opts) {
			this.opts = opts;
		}
	},
	Style: class Style {
		/** @param {any} opts */
		constructor(opts) {
			this.opts = opts;
		}
	}
}));

vi.mock('$lib/components/Map.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="mock-map"></div>' }
	}))
}));

vi.mock('$lib/components/MapHint.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div></div>' }
	}))
}));

vi.mock('$lib/map/projectionUtils.js', () => ({
	registerStorageProjection: vi.fn(),
	storageProjection: vi.fn(() => 'EPSG:25832')
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { error: vi.fn(), success: vi.fn() }
}));

global.fetch = /** @type {any} */ (vi.fn(() => Promise.resolve({ ok: false })));

const defaultData = {
	projectId: '1',
	areas: [],
	rates: [],
	nodeTypes: [],
	surfaces: [],
	constructionTypes: [],
	areaTypes: []
};

describe('Valuation Page - Map project refresh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStores.selectedProject.set('1');
		mockStores.globalMapView.set(false);
	});

	it('should render the valuation page', () => {
		const { container } = render(Page, { data: defaultData });
		expect(container).toBeTruthy();
	});

	it('should call reinitializeForProject when selectedProject store changes', async () => {
		render(Page, { data: defaultData });
		await tick();

		mockReinitializeForProject.mockClear();
		mockStores.selectedProject.set('2');
		await tick();

		expect(mockReinitializeForProject).toHaveBeenCalledWith('2');
	});
});

describe('Valuation Page - Area selection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStores.selectedProject.set('1');
		mockStores.globalMapView.set(false);
	});

	it('should toggle area checkbox when clicked', async () => {
		const testAreas = [
			{ uuid: 'area-1', name: 'Test Area 1', areaType: 'Type A', geom: null },
			{ uuid: 'area-2', name: 'Test Area 2', areaType: 'Type A', geom: null }
		];

		const { container } = render(Page, {
			data: { ...defaultData, areas: testAreas }
		});
		await tick();

		const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (
			container.querySelectorAll('input[type="checkbox"]')
		);
		const gesamtCheckbox = checkboxes[0];
		const area1Checkbox = checkboxes[1];

		expect(gesamtCheckbox.checked).toBe(true);
		expect(area1Checkbox.checked).toBe(false);

		area1Checkbox.click();
		await tick();

		expect(area1Checkbox.checked).toBe(true);
		expect(gesamtCheckbox.checked).toBe(false);
	});
});

describe('Valuation Page - Global map view', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStores.selectedProject.set('1');
		mockStores.globalMapView.set(false);
	});

	it('should call reinitializeForGlobalView when globalMapView store changes', async () => {
		render(Page, { data: defaultData });
		await tick();

		mockReinitializeForGlobalView.mockClear();
		mockStores.globalMapView.set(true);
		await tick();

		expect(mockReinitializeForGlobalView).toHaveBeenCalledWith(true);
	});

	it('should pass globalMapView initial value to MapState constructor', async () => {
		mockStores.globalMapView.set(true);
		await tick();

		render(Page, { data: defaultData });
		await tick();

		expect(mockMapStateCtorCapture.args[4]).toBe(true);
	});

	it('should fetch global areas and rates when globalMapView is activated', async () => {
		const globalAreaResponse = {
			results: {
				features: [
					{
						id: 'global-area-1',
						properties: { name: 'Global Area', area_type: { area_type: 'Type B' } },
						geometry: null
					}
				]
			}
		};
		const globalRatesResponse = { results: [{ name: 'Rate 1', amount: 100 }] };

		/** @type {any} */ (fetch).mockImplementation((/** @type {string} */ url) => {
			if (url.includes('area/')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(globalAreaResponse) });
			}
			if (url.includes('valuation-rates')) {
				return Promise.resolve({ ok: true, json: () => Promise.resolve(globalRatesResponse) });
			}
			return Promise.resolve({ ok: false });
		});

		const { container } = render(Page, { data: defaultData });
		await tick();

		mockStores.globalMapView.set(true);
		await tick();
		await tick();

		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('area/?page_size=100'),
			expect.objectContaining({ credentials: 'include' })
		);
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('valuation-rates/'),
			expect.objectContaining({ credentials: 'include' })
		);
	});
});
