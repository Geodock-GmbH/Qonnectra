import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { InquiryDrawManager } from './InquiryDrawManager.svelte.js';

function createMockMap() {
	const interactions = [];
	const layers = [];

	return {
		interactions,
		layers,
		addInteraction: vi.fn((interaction) => interactions.push(interaction)),
		removeInteraction: vi.fn((interaction) => {
			const idx = interactions.indexOf(interaction);
			if (idx >= 0) interactions.splice(idx, 1);
		}),
		addLayer: vi.fn((layer) => layers.push(layer)),
		removeLayer: vi.fn((layer) => {
			const idx = layers.indexOf(layer);
			if (idx >= 0) layers.splice(idx, 1);
		}),
		getView: vi.fn(() => ({
			getProjection: vi.fn(() => 'EPSG:25832')
		}))
	};
}

function createMockTileSource() {
	return {
		type: 'mockTileSource',
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
		on: vi.fn(),
		un: vi.fn(),
		once: vi.fn(),
		getState: vi.fn(() => 'ready'),
		getRevision: vi.fn(() => 0),
		changed: vi.fn()
	};
}

function createMockParentLayer(visible = true) {
	return {
		getVisible: vi.fn(() => visible)
	};
}

describe('InquiryDrawManager', () => {
	/** @type {InquiryDrawManager} */
	let manager;

	beforeEach(() => {
		manager = new InquiryDrawManager();
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('initial state is not drawing', () => {
		expect(manager.isDrawing).toBe(false);
	});

	test('initialize returns false without map instance', () => {
		const result = manager.initialize(null);
		expect(result).toBe(false);
	});

	test('initialize returns true with valid map instance', () => {
		const mockMap = createMockMap();
		const result = manager.initialize(mockMap);
		expect(result).toBe(true);
	});

	test('initialize adds only the polygon layer to map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		expect(mockMap.addLayer).toHaveBeenCalledOnce();
	});

	test('startDrawing sets isDrawing', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startDrawing(() => {});

		expect(manager.isDrawing).toBe(true);
	});

	test('startDrawing adds Draw interaction to map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startDrawing(() => {});

		expect(mockMap.addInteraction).toHaveBeenCalled();
	});

	test('stopDrawing resets isDrawing', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startDrawing(() => {});

		manager.stopDrawing();

		expect(manager.isDrawing).toBe(false);
	});

	test('stopDrawing removes interaction from map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startDrawing(() => {});

		manager.stopDrawing();

		expect(mockMap.removeInteraction).toHaveBeenCalled();
	});

	test('startDrawing does nothing without initialization', () => {
		manager.startDrawing(() => {});
		expect(manager.isDrawing).toBe(false);
	});

	test('cleanup is safe to call without initialization', () => {
		expect(() => manager.cleanup()).not.toThrow();
	});

	test('cleanup removes polygon layer from map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);

		manager.cleanup();

		expect(mockMap.removeLayer).toHaveBeenCalled();
	});
});

describe('InquiryDrawManager highlight overlays', () => {
	/** @type {InquiryDrawManager} */
	let manager;
	/** @type {ReturnType<typeof createMockMap>} */
	let mockMap;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		mockMap = createMockMap();
		manager.initialize(mockMap);
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('initializeHighlightLayers creates overlay layers from sources', () => {
		const sources = [
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false },
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: true }
		];

		manager.initializeHighlightLayers(sources);

		// initialize added 1 polygon layer, initializeHighlightLayers should add 2 more
		expect(mockMap.addLayer).toHaveBeenCalledTimes(3);
	});

	test('initializeHighlightLayers twice removes previous layers first', () => {
		const sources1 = [
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false }
		];
		const sources2 = [
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false },
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: true }
		];

		manager.initializeHighlightLayers(sources1);
		// 1 polygon + 1 highlight = 2 addLayer calls
		expect(mockMap.addLayer).toHaveBeenCalledTimes(2);

		manager.initializeHighlightLayers(sources2);
		// Should have removed the 1 old highlight layer
		expect(mockMap.removeLayer).toHaveBeenCalledTimes(1);
		// 1 polygon + 1 first + 2 second = 4 addLayer calls total
		expect(mockMap.addLayer).toHaveBeenCalledTimes(4);
	});

	test('refreshHighlights calls changed on all highlight layers', () => {
		const sources = [
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false },
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: true }
		];

		manager.initializeHighlightLayers(sources);

		// Spy on the highlight layers' changed method
		const highlightLayers = mockMap.layers.filter(
			(l) => l !== mockMap.layers[0] // skip polygon layer
		);
		for (const layer of highlightLayers) {
			vi.spyOn(layer, 'changed');
		}

		manager.refreshHighlights();

		for (const layer of highlightLayers) {
			expect(layer.changed).toHaveBeenCalled();
		}
	});

	test('refreshHighlights is safe without highlight layers', () => {
		expect(() => manager.refreshHighlights()).not.toThrow();
	});

	test('cleanup removes highlight layers from map', () => {
		const sources = [
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false },
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: true }
		];

		manager.initializeHighlightLayers(sources);
		const layerCountBefore = mockMap.layers.length;
		expect(layerCountBefore).toBe(3); // 1 polygon + 2 highlights

		manager.cleanup();

		// All layers should be removed
		expect(mockMap.layers.length).toBe(0);
	});
});

describe('InquiryDrawManager polygon geometry cache', () => {
	/** @type {InquiryDrawManager} */
	let manager;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		const mockMap = createMockMap();
		manager.initialize(mockMap);
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('updatePolygonGeometryCache produces empty array when no features', () => {
		manager.updatePolygonGeometryCache();
		expect(manager._polygonGeometries).toEqual([]);
	});

	test('updatePolygonGeometryCache populates geometries from polygon source', () => {
		const coords = [
			[
				[0, 0],
				[10, 0],
				[10, 10],
				[0, 10],
				[0, 0]
			]
		];
		const polygon = new Polygon(coords);
		const feature = new Feature({ geometry: polygon });

		manager._polygonSource.addFeature(feature);
		manager.updatePolygonGeometryCache();

		expect(manager._polygonGeometries).toHaveLength(1);
		expect(manager._polygonGeometries[0]).toBeInstanceOf(Polygon);
	});

	test('clearHighlights empties the polygon geometry cache', () => {
		manager._polygonGeometries = [{}]; // simulate cached geometry
		manager.clearHighlights();
		expect(manager._polygonGeometries).toEqual([]);
	});
});

describe('InquiryDrawManager removePolygonByUuid', () => {
	/** @type {InquiryDrawManager} */
	let manager;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		const mockMap = createMockMap();
		manager.initialize(mockMap);
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('removes the correct polygon by uuid', () => {
		const coords = [
			[
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 0]
			]
		];
		const f1 = new Feature({ geometry: new Polygon(coords) });
		f1.set('uuid', 'aaa');
		const f2 = new Feature({ geometry: new Polygon(coords) });
		f2.set('uuid', 'bbb');

		manager._polygonSource.addFeatures([f1, f2]);
		expect(manager._polygonSource.getFeatures()).toHaveLength(2);

		manager.removePolygonByUuid('aaa');

		const remaining = manager._polygonSource.getFeatures();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].get('uuid')).toBe('bbb');
	});
});
