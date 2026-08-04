import { tick } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from './+page.svelte';

interface MockStore<T> {
	subscribe: (callback: (value: T) => void) => () => void;
	set: (newValue: T) => void;
	update: (fn: (value: T) => T) => void;
	getValue: () => T;
}

const createMockStore = <T>(initialValue: T | null = null): MockStore<T | null> => {
	let value = initialValue;
	const subscribers = new Set<(value: T | null) => void>();
	return {
		subscribe: (callback: (value: T | null) => void) => {
			subscribers.add(callback);
			callback(value);
			return () => subscribers.delete(callback);
		},
		set: (newValue: T | null) => {
			value = newValue;
			subscribers.forEach((callback) => callback(value));
		},
		update: (fn: (value: T | null) => T | null) => {
			value = fn(value);
			subscribers.forEach((callback) => callback(value));
		},
		getValue: () => value
	};
};

// Declare mock stores at module level but define them inside vi.mock
let mockRoutingMode;
let mockRoutingTolerance;
let mockSelectedConduit;
let mockSelectedFlag;
let mockSelectedProject;
let mockTrenchColor;
let mockTrenchColorSelected;

// Mock the stores module
vi.mock('$lib/stores/store', () => {
	const createStore = <T>(initialValue: T | null = null) => {
		let value = initialValue;
		const subscribers = new Set<(value: T | null) => void>();
		return {
			subscribe: (callback: (value: T | null) => void) => {
				subscribers.add(callback);
				callback(value);
				return () => subscribers.delete(callback);
			},
			set: (newValue: T | null) => {
				value = newValue;
				subscribers.forEach((cb) => cb(value));
			},
			update: (fn: (value: T | null) => T | null) => {
				value = fn(value);
				subscribers.forEach((cb) => cb(value));
			}
		};
	};

	return {
		routingMode: createStore(false),
		routingTolerance: createStore(1),
		selectedConduit: createStore(null),
		selectedFlag: createStore(null),
		selectedProject: createStore(null),
		trenchColor: createStore('#000000'),
		trenchColorSelected: createStore('#ff0000'),
		nodeTypeStyles: createStore({}),
		addressStyle: createStore({ color: '#000000', size: 8 }),
		areaTypeStyles: createStore({}),
		labelVisibilityConfig: createStore({}),
		showLinkedTrenches: createStore(false),
		trenchConstructionTypeStyles: createStore({}),
		trenchStyleMode: createStore('default'),
		trenchSurfaceStyles: createStore({})
	};
});

// Mock the environment variables
vi.mock('$env/static/public', () => ({
	PUBLIC_API_URL: 'http://mock-api.test/'
}));

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock the navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

// Mock the page store
vi.mock('$app/stores', () => ({
	page: {
		subscribe: (callback: (value: Record<string, unknown>) => void) => {
			callback({
				url: { pathname: '/trench/1/1' },
				params: { projectId: '1', flagId: '1' },
				data: {
					srid: 25832,
					proj4Def:
						'+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
				}
			});
			return { unsubscribe: vi.fn() };
		}
	},
	navigating: {
		subscribe: (callback: (value: null) => void) => {
			callback(null);
			return { unsubscribe: vi.fn() };
		}
	}
}));

// Mock the paraglide messages - return a proxy that returns mock functions for any message key
vi.mock('$lib/paraglide/messages', () => {
	// Create a proxy that returns a mock function for any property access
	const mockMessages = new Proxy(
		{},
		{
			get: (_target: Record<string, unknown>, prop: string) => {
				// Return a function that returns the property name as a string
				return () => String(prop);
			}
		}
	);
	return { m: mockMessages };
});

// Mock the OpenLayers components
vi.mock('ol/Feature.js', () => ({
	default: class Feature {
		geometry: Record<string, unknown>;
		id?: string;
		constructor(geometry: Record<string, unknown>) {
			this.geometry = geometry;
		}
		get(key: string) {
			return (this as Record<string, unknown>)[key] || null;
		}
		getId() {
			return this.id || 'mock-feature-id';
		}
	}
}));

vi.mock('ol/format/MVT.js', () => ({
	default: class MVT {
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
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
		options: Record<string, unknown>;
		source: unknown;
		constructor(options: Record<string, unknown>) {
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
		options: Record<string, unknown>;
		source: unknown;
		visible: boolean;
		constructor(options?: Record<string, unknown>) {
			this.options = options ?? {};
			this.source = options?.source;
			this.visible = (options?.visible as boolean) ?? true;
		}
		getSource() {
			return {
				refresh: vi.fn(),
				dispose: vi.fn(),
				getKey: vi.fn(() => 'mock-key')
			};
		}
		changed() {}
		setStyle() {}
		setVisible(visible: boolean) {
			this.visible = visible;
		}
		getVisible() {
			return this.visible;
		}
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
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
			this.options = options;
		}
		refresh() {}
		dispose() {}
	}
}));

vi.mock('ol/style', () => ({
	Circle: class CircleStyle {
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
			this.options = options;
		}
	},
	RegularShape: class RegularShape {
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
			this.options = options;
		}
	},
	Style: class Style {
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
			this.options = options;
		}
	}
}));

vi.mock('ol/style/Fill.js', () => ({
	default: class Fill {
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
			this.options = options;
		}
	}
}));

vi.mock('ol/style/Stroke.js', () => ({
	default: class Stroke {
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
			this.options = options;
		}
	}
}));

vi.mock('ol/style/Text.js', () => ({
	default: class Text {
		options: Record<string, unknown>;
		constructor(options: Record<string, unknown>) {
			this.options = options;
		}
	}
}));

// Mock the component dependencies
vi.mock('$lib/components/Map.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="mock-map"></div>' }
	}))
}));

vi.mock('$lib/components/ConduitCombobox.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="mock-conduit-combobox"></div>' }
	}))
}));

vi.mock('$lib/components/GenericCombobox.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="mock-generic-combobox"></div>' }
	}))
}));

vi.mock('./TrenchTable.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="mock-trench-table"></div>' },
		addRoutedTrenches: vi.fn().mockResolvedValue(true)
	}))
}));

vi.mock('@skeletonlabs/skeleton-svelte', () => ({
	Switch: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="mock-switch"></div>' }
	})),
	Toaster: vi.fn().mockImplementation(() => ({
		$$: { render: () => '<div data-testid="mock-toaster"></div>' }
	})),
	createToaster: () => ({
		create: vi.fn()
	})
}));

// Create a mock map instance
const mockMapInstance = {
	getView: () => ({
		getProjection: () => 'EPSG:3857',
		fit: vi.fn((extent: unknown, options?: { callback?: () => void }) => {
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
global.fetch = vi.fn() as unknown as typeof fetch;

describe('Trench Page Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset fetch mock
		vi.mocked(fetch).mockReset();

		// Mock successful fetch responses
		vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
			const urlStr = String(url);
			if (urlStr.includes('trench/?id_trench=')) {
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
				}) as Promise<Response>;
			}

			if (urlStr === '/api/routing') {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							path_geometry_wkt: 'LINESTRING(0 0, 1 1, 2 2)',
							traversed_trench_uuids: ['uuid1', 'uuid2', 'uuid3'],
							traversed_trench_ids: ['101', '102', '103']
						})
				}) as Promise<Response>;
			}

			return Promise.resolve({
				ok: false,
				status: 404,
				text: () => Promise.resolve('Not found')
			}) as Promise<Response>;
		});
	});

	it('should render the trench page component', () => {
		const { container } = render(Page, {
			data: {
				flags: [],
				conduits: [],
				conduitsError: null
			}
		});

		expect(container).toBeTruthy();
	});

	it('should render with flags data', () => {
		const { container } = render(Page, {
			data: {
				flags: [{ id: 1, flag: 'Test Flag' }],
				conduits: [],
				conduitsError: null
			}
		});

		expect(container).toBeTruthy();
	});

	it('should render with conduits data', () => {
		const { container } = render(Page, {
			data: {
				flags: [],
				conduits: [{ value: '1', label: 'Test Conduit' }],
				conduitsError: null
			}
		});

		expect(container).toBeTruthy();
	});

	it('should render with both flags and conduits', () => {
		const { container } = render(Page, {
			data: {
				flags: [{ id: 1, flag: 'Test Flag' }],
				conduits: [{ value: '1', label: 'Test Conduit' }],
				conduitsError: null
			}
		});

		expect(container).toBeTruthy();
	});
});
