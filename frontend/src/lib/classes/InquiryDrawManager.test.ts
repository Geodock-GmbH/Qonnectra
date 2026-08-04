import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import type OlMap from 'ol/Map.js';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { InquiryDrawManager } from '$lib/classes/InquiryDrawManager.svelte';

interface MockMap {
	interactions: unknown[];
	layers: unknown[];
	addInteraction: ReturnType<typeof vi.fn>;
	removeInteraction: ReturnType<typeof vi.fn>;
	addLayer: ReturnType<typeof vi.fn>;
	removeLayer: ReturnType<typeof vi.fn>;
	getView: ReturnType<typeof vi.fn>;
}

function createMockMap(): MockMap {
	const interactions: unknown[] = [];
	const layers: unknown[] = [];

	return {
		interactions,
		layers,
		addInteraction: vi.fn((interaction: unknown) => interactions.push(interaction)),
		removeInteraction: vi.fn((interaction: unknown) => {
			const idx = interactions.indexOf(interaction);
			if (idx >= 0) interactions.splice(idx, 1);
		}),
		addLayer: vi.fn((layer: unknown) => layers.push(layer)),
		removeLayer: vi.fn((layer: unknown) => {
			const idx = layers.indexOf(layer);
			if (idx >= 0) layers.splice(idx, 1);
		}),
		getView: vi.fn(() => ({
			getProjection: vi.fn(() => 'EPSG:25832')
		}))
	};
}

function createMockTileSource(): Record<string, ReturnType<typeof vi.fn> | string> {
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

function createMockParentLayer(visible = true): { getVisible: ReturnType<typeof vi.fn> } {
	return {
		getVisible: vi.fn(() => visible)
	};
}

describe('InquiryDrawManager', () => {
	let manager: InquiryDrawManager;

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
		const result = manager.initialize(mockMap as unknown as OlMap);
		expect(result).toBe(true);
	});

	test('initialize adds only the polygon layer to map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
		expect(mockMap.addLayer).toHaveBeenCalledOnce();
	});

	test('startDrawing sets isDrawing', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
		manager.startDrawing(() => {});

		expect(manager.isDrawing).toBe(true);
	});

	test('startDrawing adds Draw interaction to map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
		manager.startDrawing(() => {});

		expect(mockMap.addInteraction).toHaveBeenCalled();
	});

	test('stopDrawing resets isDrawing', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
		manager.startDrawing(() => {});

		manager.stopDrawing();

		expect(manager.isDrawing).toBe(false);
	});

	test('stopDrawing removes interaction from map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
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
		manager.initialize(mockMap as unknown as OlMap);

		manager.cleanup();

		expect(mockMap.removeLayer).toHaveBeenCalled();
	});
});

describe('InquiryDrawManager highlight overlays', () => {
	let manager: InquiryDrawManager;
	let mockMap: MockMap;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('initializeHighlightLayers creates overlay layers from sources', () => {
		const sources = [
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false },
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: true }
		];

		manager.initializeHighlightLayers(sources as never);

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

		manager.initializeHighlightLayers(sources1 as never);
		// 1 polygon + 1 highlight = 2 addLayer calls
		expect(mockMap.addLayer).toHaveBeenCalledTimes(2);

		manager.initializeHighlightLayers(sources2 as never);
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

		manager.initializeHighlightLayers(sources as never);

		const highlightLayers = mockMap.layers.filter(
			(l: unknown) => l !== mockMap.layers[0]
		);
		for (const layer of highlightLayers) {
			vi.spyOn(layer as { changed: () => void }, 'changed');
		}

		manager.refreshHighlights();

		for (const layer of highlightLayers) {
			expect((layer as { changed: ReturnType<typeof vi.fn> }).changed).toHaveBeenCalled();
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

		manager.initializeHighlightLayers(sources as never);
		const layerCountBefore = mockMap.layers.length;
		expect(layerCountBefore).toBe(3); // 1 polygon + 2 highlights

		manager.cleanup();

		// All layers should be removed
		expect(mockMap.layers.length).toBe(0);
	});
});

describe('InquiryDrawManager polygon geometry cache', () => {
	let manager: InquiryDrawManager;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
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

		(manager as unknown as { _polygonSource: { addFeature: (f: Feature) => void } })._polygonSource.addFeature(feature);
		manager.updatePolygonGeometryCache();

		expect(manager._polygonGeometries).toHaveLength(1);
		expect(manager._polygonGeometries[0]).toBeInstanceOf(Polygon);
	});

	test('clearHighlights empties the polygon geometry cache', () => {
		(manager as unknown as { _polygonGeometries: unknown[] })._polygonGeometries = [{}]; // simulate cached geometry
		manager.clearHighlights();
		expect(manager._polygonGeometries).toEqual([]);
	});
});

describe('InquiryDrawManager removePolygonByUuid', () => {
	let manager: InquiryDrawManager;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
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

		const source = (manager as unknown as { _polygonSource: { addFeatures: (f: Feature[]) => void; getFeatures: () => Feature[] } })._polygonSource;
		source.addFeatures([f1, f2]);
		expect(source.getFeatures()).toHaveLength(2);

		manager.removePolygonByUuid('aaa');

		const remaining = source.getFeatures();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].get('uuid')).toBe('bbb');
	});
});

describe('InquiryDrawManager polygon label style', () => {
	let manager: InquiryDrawManager;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('polygon layer uses a style function, not a static style', () => {
		const style = (manager as unknown as { _polygonLayer: { getStyle: () => unknown } })._polygonLayer.getStyle();
		expect(typeof style).toBe('function');
	});

	test('style function returns label when feature has name and resolution is low', () => {
		const styleFn = (manager as unknown as { _polygonLayer: { getStyle: () => (f: Feature, r: number) => unknown } })._polygonLayer.getStyle();
		const feature = new Feature({
			geometry: new Polygon([
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 0]
				]
			])
		});
		feature.set('name', 'Test Area');

		const result = styleFn(feature, 2.0) as { getText: () => { getText: () => string } }[];

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(2);
		expect(result[1].getText()).toBeTruthy();
		expect(result[1].getText().getText()).toBe('Test Area');
	});

	test('style function returns single style when feature has no name', () => {
		const styleFn = (manager as unknown as { _polygonLayer: { getStyle: () => (f: Feature, r: number) => unknown } })._polygonLayer.getStyle();
		const feature = new Feature({
			geometry: new Polygon([
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 0]
				]
			])
		});

		const result = styleFn(feature, 2.0);

		expect(Array.isArray(result)).toBe(false);
	});

	test('style function returns single style when resolution is too high', () => {
		const styleFn = (manager as unknown as { _polygonLayer: { getStyle: () => (f: Feature, r: number) => unknown } })._polygonLayer.getStyle();
		const feature = new Feature({
			geometry: new Polygon([
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 0]
				]
			])
		});
		feature.set('name', 'Test Area');

		const result = styleFn(feature, 10.0);

		expect(Array.isArray(result)).toBe(false);
	});
});

describe('InquiryDrawManager editing interaction', () => {
	let manager: InquiryDrawManager;
	let mockMap: MockMap;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('initial state is not editing', () => {
		expect(manager.isEditing).toBe(false);
	});

	test('startEditing sets isEditing', () => {
		manager.startEditing(() => {});
		expect(manager.isEditing).toBe(true);
	});

	test('startEditing adds Modify interaction to map', () => {
		manager.startEditing(() => {});
		expect(mockMap.addInteraction).toHaveBeenCalled();
	});

	test('stopEditing resets isEditing', () => {
		manager.startEditing(() => {});
		manager.stopEditing();
		expect(manager.isEditing).toBe(false);
	});

	test('stopEditing removes interaction from map', () => {
		manager.startEditing(() => {});
		manager.stopEditing();
		expect(mockMap.removeInteraction).toHaveBeenCalled();
	});

	test('startEditing does nothing without initialization', () => {
		const uninitManager = new InquiryDrawManager();
		uninitManager.startEditing(() => {});
		expect(uninitManager.isEditing).toBe(false);
	});

	test('startDrawing stops active editing', () => {
		manager.startEditing(() => {});
		expect(manager.isEditing).toBe(true);

		manager.startDrawing(() => {});
		expect(manager.isEditing).toBe(false);
		expect(manager.isDrawing).toBe(true);
	});

	test('startEditing stops active drawing', () => {
		manager.startDrawing(() => {});
		expect(manager.isDrawing).toBe(true);

		manager.startEditing(() => {});
		expect(manager.isDrawing).toBe(false);
		expect(manager.isEditing).toBe(true);
	});

	test('cleanup stops editing', () => {
		manager.startEditing(() => {});
		expect(manager.isEditing).toBe(true);

		manager.cleanup();
		expect(manager.isEditing).toBe(false);
	});
});
