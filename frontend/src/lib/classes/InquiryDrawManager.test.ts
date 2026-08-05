import type OlMap from 'ol/Map.js';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Style from 'ol/style/Style.js';
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

		const highlightLayers = mockMap.layers.filter((l: unknown) => l !== mockMap.layers[0]);
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

		(
			manager as unknown as { _polygonSource: { addFeature: (f: Feature) => void } }
		)._polygonSource.addFeature(feature);
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

		const source = (
			manager as unknown as {
				_polygonSource: { addFeatures: (f: Feature[]) => void; getFeatures: () => Feature[] };
			}
		)._polygonSource;
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
		const style = (
			manager as unknown as { _polygonLayer: { getStyle: () => unknown } }
		)._polygonLayer.getStyle();
		expect(typeof style).toBe('function');
	});

	test('style function returns label when feature has name and resolution is low', () => {
		const styleFn = (
			manager as unknown as {
				_polygonLayer: { getStyle: () => (f: Feature, r: number) => unknown };
			}
		)._polygonLayer.getStyle();
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
		const styleFn = (
			manager as unknown as {
				_polygonLayer: { getStyle: () => (f: Feature, r: number) => unknown };
			}
		)._polygonLayer.getStyle();
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
		const styleFn = (
			manager as unknown as {
				_polygonLayer: { getStyle: () => (f: Feature, r: number) => unknown };
			}
		)._polygonLayer.getStyle();
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

/**
 * Access the private polygon source of a manager for test assertions.
 */
function polygonSource(manager: InquiryDrawManager): {
	getFeatures: () => Feature[];
	addFeature: (f: Feature) => void;
	addFeatures: (f: Feature[]) => void;
	clear: () => void;
} {
	return (
		manager as unknown as {
			_polygonSource: {
				getFeatures: () => Feature[];
				addFeature: (f: Feature) => void;
				addFeatures: (f: Feature[]) => void;
				clear: () => void;
			};
		}
	)._polygonSource;
}

describe('InquiryDrawManager renderPolygons', () => {
	let manager: InquiryDrawManager;

	beforeEach(() => {
		manager = new InquiryDrawManager();
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
	});

	afterEach(() => {
		manager.cleanup();
	});

	function squareGeoJson(props: Record<string, unknown> = {}): Record<string, unknown> {
		return {
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[0, 0],
						[10, 0],
						[10, 10],
						[0, 10],
						[0, 0]
					]
				]
			},
			properties: props
		};
	}

	test('renders GeoJSON features onto the polygon source', () => {
		manager.renderPolygons([squareGeoJson({ uuid: 'x1' })], null, null);

		const features = polygonSource(manager).getFeatures();
		expect(features).toHaveLength(1);
		expect(features[0].getGeometry()).toBeInstanceOf(Polygon);
		expect(features[0].get('uuid')).toBe('x1');
	});

	test('renders multiple features', () => {
		manager.renderPolygons(
			[squareGeoJson({ uuid: 'a' }), squareGeoJson({ uuid: 'b' })],
			null,
			null
		);
		expect(polygonSource(manager).getFeatures()).toHaveLength(2);
	});

	test('clears existing polygons before rendering new ones', () => {
		manager.renderPolygons([squareGeoJson({ uuid: 'old' })], null, null);
		expect(polygonSource(manager).getFeatures()).toHaveLength(1);

		manager.renderPolygons([squareGeoJson({ uuid: 'new' })], null, null);
		const features = polygonSource(manager).getFeatures();
		expect(features).toHaveLength(1);
		expect(features[0].get('uuid')).toBe('new');
	});

	test('empty feature array clears the source without adding anything', () => {
		manager.renderPolygons([squareGeoJson()], null, null);
		expect(polygonSource(manager).getFeatures()).toHaveLength(1);

		manager.renderPolygons([], null, null);
		expect(polygonSource(manager).getFeatures()).toHaveLength(0);
	});

	test('reprojects coordinates when projections are supplied', () => {
		manager.renderPolygons([squareGeoJson()], 'EPSG:4326', 'EPSG:3857');
		const geom = polygonSource(manager).getFeatures()[0].getGeometry() as Polygon;
		const firstCoord = geom.getCoordinates()[0][0];

		// EPSG:4326 [0,0] reprojected to 3857 stays at origin; a lon of 10 must map
		// to a large web-mercator x, proving reprojection actually ran.
		expect(Math.abs(firstCoord[0])).toBeLessThan(1);
		const secondCoord = geom.getCoordinates()[0][1];
		expect(secondCoord[0]).toBeGreaterThan(1000000);
	});

	test('does nothing when polygon source is missing', () => {
		const uninit = new InquiryDrawManager();
		expect(() => uninit.renderPolygons([squareGeoJson()], null, null)).not.toThrow();
	});
});

describe('InquiryDrawManager highlight style function', () => {
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

	function getHighlightStyleFn(
		parentLayer: { getVisible: () => boolean },
		isPoint: boolean
	): (feature: unknown) => unknown {
		manager.initializeHighlightLayers([
			{ source: createMockTileSource(), parentLayer, isPoint }
		] as never);
		const layer = mockMap.layers[mockMap.layers.length - 1] as {
			getStyle: () => (feature: unknown) => unknown;
		};
		return layer.getStyle();
	}

	/**
	 * Build a minimal RenderFeature-like object covering the surface used by
	 * featureIntersectsPolygons.
	 */
	function mockRenderFeature(
		type: string,
		flatCoords: number[],
		extent: number[]
	): Record<string, () => unknown> {
		return {
			getExtent: () => extent,
			getFlatCoordinates: () => flatCoords,
			getType: () => type
		};
	}

	function cachePolygon(manager: InquiryDrawManager): void {
		const feature = new Feature({
			geometry: new Polygon([
				[
					[0, 0],
					[10, 0],
					[10, 10],
					[0, 10],
					[0, 0]
				]
			])
		});
		polygonSource(manager).addFeature(feature);
		manager.updatePolygonGeometryCache();
	}

	test('returns undefined when no polygons are cached', () => {
		const styleFn = getHighlightStyleFn(createMockParentLayer(true), false);
		const feature = mockRenderFeature('Point', [5, 5], [5, 5, 5, 5]);
		expect(styleFn(feature)).toBeUndefined();
	});

	test('returns undefined when parent layer is not visible', () => {
		const styleFn = getHighlightStyleFn(createMockParentLayer(false), false);
		cachePolygon(manager);
		const feature = mockRenderFeature('Point', [5, 5], [5, 5, 5, 5]);
		expect(styleFn(feature)).toBeUndefined();
	});

	test('returns a style for a point inside a cached polygon', () => {
		const styleFn = getHighlightStyleFn(createMockParentLayer(true), true);
		cachePolygon(manager);
		const feature = mockRenderFeature('Point', [5, 5], [5, 5, 5, 5]);
		const style = styleFn(feature) as Style;
		expect(style).toBeInstanceOf(Style);
		// point highlight style is image-based, not stroke-based
		expect(style.getImage()).toBeTruthy();
	});

	test('returns undefined for a point outside every cached polygon', () => {
		const styleFn = getHighlightStyleFn(createMockParentLayer(true), true);
		cachePolygon(manager);
		const feature = mockRenderFeature('Point', [100, 100], [100, 100, 100, 100]);
		expect(styleFn(feature)).toBeUndefined();
	});

	test('returns a style for a line feature crossing a cached polygon', () => {
		const styleFn = getHighlightStyleFn(createMockParentLayer(true), false);
		cachePolygon(manager);
		// A LineString from outside into the polygon; one vertex lands inside.
		const feature = mockRenderFeature('LineString', [-5, -5, 5, 5], [-5, -5, 5, 5]);
		const style = styleFn(feature) as Style;
		expect(style).toBeInstanceOf(Style);
		// line/polygon highlight style is stroke-based, not image-based
		expect(style.getStroke()).toBeTruthy();
	});

	test('extent pre-filter skips polygons the feature cannot reach', () => {
		const styleFn = getHighlightStyleFn(createMockParentLayer(true), false);
		cachePolygon(manager);
		// Feature extent far from the polygon: intersectsExtent short-circuits.
		const feature = mockRenderFeature('LineString', [500, 500, 600, 600], [500, 500, 600, 600]);
		expect(styleFn(feature)).toBeUndefined();
	});
});

describe('InquiryDrawManager draw/modify callbacks', () => {
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

	/**
	 * Retrieve the last interaction added to the mock map.
	 */
	function lastInteraction(): { dispatchEvent: (e: unknown) => void } {
		return mockMap.interactions[mockMap.interactions.length - 1] as {
			dispatchEvent: (e: unknown) => void;
		};
	}

	test('onDrawEnd is invoked with the drawn feature on drawend', () => {
		const onDrawEnd = vi.fn();
		manager.startDrawing(onDrawEnd);

		const drawFeature = new Feature({
			geometry: new Polygon([
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 0]
				]
			])
		});

		const draw = lastInteraction();
		draw.dispatchEvent({ type: 'drawend', feature: drawFeature });

		expect(onDrawEnd).toHaveBeenCalledTimes(1);
		expect(onDrawEnd).toHaveBeenCalledWith(drawFeature);
	});

	test('drawend does not fire the callback after stopDrawing', () => {
		const onDrawEnd = vi.fn();
		manager.startDrawing(onDrawEnd);
		const draw = lastInteraction();

		manager.stopDrawing();
		draw.dispatchEvent({
			type: 'drawend',
			feature: new Feature({
				geometry: new Polygon([
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 0]
					]
				])
			})
		});

		expect(onDrawEnd).not.toHaveBeenCalled();
	});

	test('onModifyEnd is invoked for each modified feature on modifyend', () => {
		const onModifyEnd = vi.fn();
		manager.startEditing(onModifyEnd);

		const f1 = new Feature();
		const f2 = new Feature();
		const modify = lastInteraction();
		modify.dispatchEvent({
			type: 'modifyend',
			features: { getArray: () => [f1, f2] }
		});

		expect(onModifyEnd).toHaveBeenCalledTimes(2);
		expect(onModifyEnd).toHaveBeenNthCalledWith(1, f1);
		expect(onModifyEnd).toHaveBeenNthCalledWith(2, f2);
	});

	test('modifyend does not fire the callback after stopEditing', () => {
		const onModifyEnd = vi.fn();
		manager.startEditing(onModifyEnd);
		const modify = lastInteraction();

		manager.stopEditing();
		modify.dispatchEvent({
			type: 'modifyend',
			features: { getArray: () => [new Feature()] }
		});

		expect(onModifyEnd).not.toHaveBeenCalled();
	});
});

describe('InquiryDrawManager edge cases', () => {
	test('updatePolygonGeometryCache resets to empty when source is missing', () => {
		const manager = new InquiryDrawManager();
		(manager as unknown as { _polygonGeometries: unknown[] })._polygonGeometries = [{}];
		manager.updatePolygonGeometryCache();
		expect(manager._polygonGeometries).toEqual([]);
	});

	test('removePolygonByUuid is a no-op when source is missing', () => {
		const manager = new InquiryDrawManager();
		expect(() => manager.removePolygonByUuid('nope')).not.toThrow();
	});

	test('removePolygonByUuid leaves features untouched when uuid is absent', () => {
		const manager = new InquiryDrawManager();
		manager.initialize(createMockMap() as unknown as OlMap);
		const f = new Feature({
			geometry: new Polygon([
				[
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 0]
				]
			])
		});
		f.set('uuid', 'keep');
		polygonSource(manager).addFeature(f);

		manager.removePolygonByUuid('missing');

		expect(polygonSource(manager).getFeatures()).toHaveLength(1);
		manager.cleanup();
	});

	test('initializeHighlightLayers is a no-op without a map', () => {
		const manager = new InquiryDrawManager();
		expect(() =>
			manager.initializeHighlightLayers([
				{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false }
			] as never)
		).not.toThrow();
	});

	test('clearHighlights refreshes highlight layers after clearing cache', () => {
		const manager = new InquiryDrawManager();
		const mockMap = createMockMap();
		manager.initialize(mockMap as unknown as OlMap);
		manager.initializeHighlightLayers([
			{ source: createMockTileSource(), parentLayer: createMockParentLayer(), isPoint: false }
		] as never);

		const highlightLayer = mockMap.layers[mockMap.layers.length - 1] as { changed: () => void };
		const spy = vi.spyOn(highlightLayer, 'changed');

		manager.clearHighlights();

		expect(manager._polygonGeometries).toEqual([]);
		expect(spy).toHaveBeenCalled();
		manager.cleanup();
	});
});
