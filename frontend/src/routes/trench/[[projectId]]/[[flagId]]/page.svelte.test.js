import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import Page from './+page.svelte';

// Mock the stores
vi.mock('$lib/stores/store', () => ({
	routingMode: { subscribe: vi.fn(), set: vi.fn() },
	routingTolerance: { subscribe: vi.fn() },
	selectedConduit: { subscribe: vi.fn(), set: vi.fn() },
	selectedFlag: { subscribe: vi.fn() },
	selectedProject: { subscribe: vi.fn() },
	trenchColor: { subscribe: vi.fn() },
	trenchColorSelected: { subscribe: vi.fn() }
}));

// Mock the environment variables
vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

// Mock the navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

// Mock the page store
vi.mock('$app/stores', () => ({
	page: {
		subscribe: (callback) => {
			callback({ url: { pathname: '/trench/1/1' } });
			return { unsubscribe: vi.fn() };
		}
	},
	navigating: {
		subscribe: (callback) => {
			callback(null);
			return { unsubscribe: vi.fn() };
		}
	}
}));

// Mock the paraglide messages
vi.mock('$lib/paraglide/messages', () => ({
	m: {
		error_loading_map_features: () => 'Error loading map features',
		error_loading_map_features_description: () => 'Failed to load map features',
		error_creating_vector_tile_layer: () => 'Error creating vector tile layer',
		error_creating_vector_tile_layer_description: () => 'Failed to create vector tile layer',
		trench_located: () => 'Trench located',
		trench_located_description: () => 'Trench has been located',
		trench_not_visible: () => 'Trench not visible',
		trench_not_visible_description: () => 'Trench is not visible',
		no_conduit_selected: () => 'No conduit selected',
		no_conduit_selected_description: () => 'Please select a conduit',
		error_calculating_route: () => 'Error calculating route',
		error_calculating_route_description: () => 'Failed to calculate route',
		settings_map_routing_mode: () => 'Routing Mode',
		flag: () => 'Flag',
		conduit: () => 'Conduit',
		conduit_connection: () => 'Conduit Connection'
	}
}));

// Mock the OpenLayers components
vi.mock('ol/Feature.js', () => ({
	default: class Feature {
		constructor(geometry) {
			this.geometry = geometry;
		}
		get(key) {
			return this[key] || null;
		}
		getId() {
			return this.id || 'mock-feature-id';
		}
	}
}));

vi.mock('ol/format/MVT.js', () => ({
	default: class MVT {
		constructor(options) {
			this.options = options;
		}
		readFeatures() {
			return [];
		}
	}
}));

vi.mock('ol/format/WKT.js', () => ({
	default: class WKT {
		readGeometry() {
			return {
				getExtent: () => [0, 0, 100, 100]
			};
		}
		readFeature() {
			return {
				geometry: {
					getExtent: () => [0, 0, 100, 100]
				}
			};
		}
	}
}));

vi.mock('ol/layer/Vector.js', () => ({
	default: class VectorLayer {
		constructor(options) {
			this.options = options;
			this.source = options.source;
		}
		getSource() {
			return {
				addFeature: vi.fn(),
				removeFeature: vi.fn(),
				clear: vi.fn(),
				dispose: vi.fn()
			};
		}
		changed() {}
	}
}));

vi.mock('ol/layer/VectorTile.js', () => ({
	default: class VectorTileLayer {
		constructor(options) {
			this.options = options;
			this.source = options.source;
		}
		getSource() {
			return {
				refresh: vi.fn(),
				dispose: vi.fn()
			};
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

vi.mock('ol/source/VectorTile.js', () => ({
	default: class VectorTileSource {
		constructor(options) {
			this.options = options;
		}
		refresh() {}
		dispose() {}
	}
}));

vi.mock('ol/style', () => ({
	Circle: class CircleStyle {
		constructor(options) {
			this.options = options;
		}
	},
	Style: class Style {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('ol/style/Fill.js', () => ({
	default: class Fill {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('ol/style/Stroke.js', () => ({
	default: class Stroke {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('ol/style/Text.js', () => ({
	default: class Text {
		constructor(options) {
			this.options = options;
		}
	}
}));

// Mock the component dependencies
vi.mock('$lib/components/Map.svelte', () => ({
	default: {
		render: (props) => {
			return {
				component: {
					$$: {
						callbacks: {
							ready: [props.on?.ready]
						}
					},
					$on: (event, callback) => {
						if (event === 'ready') {
							callback({ detail: { map: mockMapInstance } });
						}
					}
				},
				html: '<div class="mock-map"></div>'
			};
		}
	}
}));

vi.mock('$lib/components/ConduitCombobox.svelte', () => ({
	default: {
		render: () => {
			return {
				html: '<div class="mock-conduit-combobox"></div>'
			};
		}
	}
}));

vi.mock('$lib/components/FlagCombobox.svelte', () => ({
	default: {
		render: () => {
			return {
				html: '<div class="mock-flag-combobox"></div>'
			};
		}
	}
}));

vi.mock('$lib/components/TrenchTable.svelte', () => ({
	default: {
		render: () => {
			return {
				component: {
					addRoutedTrenches: vi.fn().mockResolvedValue(true)
				},
				html: '<div class="mock-trench-table"></div>'
			};
		}
	}
}));

vi.mock('@skeletonlabs/skeleton-svelte', () => ({
	Switch: {
		render: () => {
			return {
				html: '<div class="mock-switch"></div>'
			};
		}
	},
	Toaster: {
		render: () => {
			return {
				html: '<div class="mock-toaster"></div>'
			};
		}
	},
	createToaster: () => ({
		create: vi.fn()
	})
}));

// Create a mock map instance
const mockMapInstance = {
	getView: () => ({
		getProjection: () => 'EPSG:3857',
		fit: vi.fn((extent, options) => {
			if (options && options.callback) {
				options.callback();
			}
		})
	}),
	addLayer: vi.fn(),
	removeLayer: vi.fn(),
	on: vi.fn(),
	un: vi.fn(),
	getFeaturesAtPixel: vi.fn().mockReturnValue([])
};

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Trench Page Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset fetch mock
		fetch.mockReset();

		// Mock successful fetch responses
		fetch.mockImplementation((url) => {
			if (url.includes('ol_trench')) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							results: {
								features: [
									{
										geometry: {
											type: 'LineString',
											coordinates: [
												[0, 0],
												[1, 1]
											]
										}
									}
								]
							}
						})
				});
			}

			if (url === '/api/routing') {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							path_geometry_wkt: 'LINESTRING(0 0, 1 1, 2 2)',
							traversed_trench_uuids: ['uuid1', 'uuid2', 'uuid3'],
							traversed_trench_ids: ['101', '102', '103']
						})
				});
			}

			return Promise.resolve({
				ok: false,
				status: 404,
				text: () => Promise.resolve('Not found')
			});
		});
	});

	it('should render the trench page component', () => {
		const { container } = render(Page, {
			data: {
				flags: [],
				conduits: []
			}
		});

		expect(container).toBeTruthy();
	});

	it('should handle map ready event', async () => {
		render(Page, {
			data: {
				flags: [],
				conduits: []
			}
		});

		// Map ready event is triggered in the mock
		expect(mockMapInstance.addLayer).toHaveBeenCalled();
		expect(mockMapInstance.on).toHaveBeenCalledWith('click', expect.any(Function));
	});

	it('should handle trench click', async () => {
		const { component } = render(Page, {
			data: {
				flags: [],
				conduits: []
			}
		});

		// Call the handleTrenchClick method
		await component.handleTrenchClick('123', '123');

		// Verify fetch was called with the correct URL
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('ol_trench/?id_trench=123'),
			expect.any(Object)
		);
	});

	it('should handle map click in routing mode', async () => {
		// Mock the routingMode store to be true
		const routingModeStore = vi.spyOn(vi.mocked('$lib/stores/store').routingMode, 'subscribe');
		routingModeStore.mockImplementation((callback) => {
			callback(true);
			return { unsubscribe: vi.fn() };
		});

		// Mock the selectedConduit store to have a value
		const selectedConduitStore = vi.spyOn(
			vi.mocked('$lib/stores/store').selectedConduit,
			'subscribe'
		);
		selectedConduitStore.mockImplementation((callback) => {
			callback('mock-conduit-id');
			return { unsubscribe: vi.fn() };
		});

		// Mock the selectedProject store
		const selectedProjectStore = vi.spyOn(
			vi.mocked('$lib/stores/store').selectedProject,
			'subscribe'
		);
		selectedProjectStore.mockImplementation((callback) => {
			callback('1');
			return { unsubscribe: vi.fn() };
		});

		// Mock the routingTolerance store
		const routingToleranceStore = vi.spyOn(
			vi.mocked('$lib/stores/store').routingTolerance,
			'subscribe'
		);
		routingToleranceStore.mockImplementation((callback) => {
			callback(1);
			return { unsubscribe: vi.fn() };
		});

		const { component } = render(Page, {
			data: {
				flags: [],
				conduits: []
			}
		});

		// Mock features for map clicks
		const mockFeature1 = {
			get: (key) => (key === 'id_trench' ? '101' : null),
			getId: () => 'uuid1'
		};

		const mockFeature2 = {
			get: (key) => (key === 'id_trench' ? '103' : null),
			getId: () => 'uuid3'
		};

		// Mock getFeaturesAtPixel to return our mock features
		mockMapInstance.getFeaturesAtPixel.mockImplementationOnce(() => [mockFeature1]);

		// Simulate first map click
		const mapClickHandler = mockMapInstance.on.mock.calls.find((call) => call[0] === 'click')[1];
		await mapClickHandler({ pixel: [100, 100] });

		// Verify first click sets startTrenchId
		expect(component.startTrenchId).toBe('101');

		// Mock second feature for second click
		mockMapInstance.getFeaturesAtPixel.mockImplementationOnce(() => [mockFeature2]);

		// Simulate second map click
		await mapClickHandler({ pixel: [200, 200] });

		// Verify second click sets endTrenchId and calls the routing API
		expect(component.endTrenchId).toBe('103');
		expect(fetch).toHaveBeenCalledWith(
			'/api/routing',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				}),
				body: JSON.stringify({
					startTrenchId: '101',
					endTrenchId: '103',
					projectId: '1',
					tolerance: 1
				})
			})
		);
	});

	it('should handle routing API errors', async () => {
		// Mock the routingMode store to be true
		const routingModeStore = vi.spyOn(vi.mocked('$lib/stores/store').routingMode, 'subscribe');
		routingModeStore.mockImplementation((callback) => {
			callback(true);
			return { unsubscribe: vi.fn() };
		});

		// Mock the selectedConduit store to have a value
		const selectedConduitStore = vi.spyOn(
			vi.mocked('$lib/stores/store').selectedConduit,
			'subscribe'
		);
		selectedConduitStore.mockImplementation((callback) => {
			callback('mock-conduit-id');
			return { unsubscribe: vi.fn() };
		});

		// Mock fetch to return an error for routing
		fetch.mockImplementation((url) => {
			if (url === '/api/routing') {
				return Promise.resolve({
					ok: false,
					status: 404,
					json: () => Promise.resolve({ error: 'No path found between trenches' })
				});
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
		});

		const { component } = render(Page, {
			data: {
				flags: [],
				conduits: []
			}
		});

		// Mock features for map clicks
		const mockFeature1 = {
			get: (key) => (key === 'id_trench' ? '101' : null),
			getId: () => 'uuid1'
		};

		const mockFeature2 = {
			get: (key) => (key === 'id_trench' ? '103' : null),
			getId: () => 'uuid3'
		};

		// Mock getFeaturesAtPixel to return our mock features
		mockMapInstance.getFeaturesAtPixel.mockImplementationOnce(() => [mockFeature1]);

		// Simulate first map click
		const mapClickHandler = mockMapInstance.on.mock.calls.find((call) => call[0] === 'click')[1];
		await mapClickHandler({ pixel: [100, 100] });

		// Mock second feature for second click
		mockMapInstance.getFeaturesAtPixel.mockImplementationOnce(() => [mockFeature2]);

		// Simulate second map click
		await mapClickHandler({ pixel: [200, 200] });

		// Verify error handling
		expect(fetch).toHaveBeenCalledWith('/api/routing', expect.any(Object));
		expect(component.toaster.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'error',
				title: 'Error calculating route'
			})
		);
	});

	it('should handle single-click mode (non-routing mode)', async () => {
		// Mock the routingMode store to be false
		const routingModeStore = vi.spyOn(vi.mocked('$lib/stores/store').routingMode, 'subscribe');
		routingModeStore.mockImplementation((callback) => {
			callback(false);
			return { unsubscribe: vi.fn() };
		});

		// Mock the selectedConduit store to have a value
		const selectedConduitStore = vi.spyOn(
			vi.mocked('$lib/stores/store').selectedConduit,
			'subscribe'
		);
		selectedConduitStore.mockImplementation((callback) => {
			callback('mock-conduit-id');
			return { unsubscribe: vi.fn() };
		});

		const { component } = render(Page, {
			data: {
				flags: [],
				conduits: []
			}
		});

		// Mock feature for map click
		const mockFeature = {
			get: (key) => (key === 'id_trench' ? '101' : null),
			getId: () => 'uuid1'
		};

		// Mock getFeaturesAtPixel to return our mock feature
		mockMapInstance.getFeaturesAtPixel.mockImplementationOnce(() => [mockFeature]);

		// Simulate map click
		const mapClickHandler = mockMapInstance.on.mock.calls.find((call) => call[0] === 'click')[1];
		await mapClickHandler({ pixel: [100, 100] });

		// Verify single-click behavior
		expect(component.selectionStore).toEqual({ uuid1: mockFeature });
		expect(component.trenchTableInstance.addRoutedTrenches).toHaveBeenCalledWith([
			{ value: 'uuid1', label: '101' }
		]);
	});
});
