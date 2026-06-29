import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MapMeasureManager } from './MapMeasureManager.svelte.js';

function createMockMap() {
	const interactions = [];
	const layers = [];
	const overlays = [];

	return {
		interactions,
		layers,
		overlays,
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
		addOverlay: vi.fn((overlay) => overlays.push(overlay)),
		removeOverlay: vi.fn((overlay) => {
			const idx = overlays.indexOf(overlay);
			if (idx >= 0) overlays.splice(idx, 1);
		}),
		getView: vi.fn(() => ({
			getProjection: vi.fn(() => 'EPSG:25832')
		}))
	};
}

describe('MapMeasureManager', () => {
	/** @type {MapMeasureManager} */
	let manager;

	beforeEach(() => {
		manager = new MapMeasureManager();
	});

	afterEach(() => {
		manager.cleanup();
	});

	test('initial state is not measuring', () => {
		expect(manager.isMeasuring).toBe(false);
		expect(manager.measureType).toBe(null);
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

	test('initialize adds vector layer to map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		expect(mockMap.addLayer).toHaveBeenCalledOnce();
	});

	test('startMeasure sets isMeasuring and measureType for distance', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startMeasure('distance');

		expect(manager.isMeasuring).toBe(true);
		expect(manager.measureType).toBe('distance');
	});

	test('startMeasure sets isMeasuring and measureType for area', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startMeasure('area');

		expect(manager.isMeasuring).toBe(true);
		expect(manager.measureType).toBe('area');
	});

	test('startMeasure adds Draw interaction to map', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startMeasure('distance');

		expect(mockMap.addInteraction).toHaveBeenCalled();
	});

	test('startMeasure while already measuring clears previous measurement', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);

		manager.startMeasure('distance');
		expect(mockMap.addInteraction).toHaveBeenCalledTimes(1);

		manager.startMeasure('area');
		expect(mockMap.removeInteraction).toHaveBeenCalled();
		expect(manager.measureType).toBe('area');
	});

	test('startMeasure does nothing without initialization', () => {
		manager.startMeasure('distance');
		expect(manager.isMeasuring).toBe(false);
	});

	test('stopMeasure removes interaction and resets state', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startMeasure('distance');

		manager.stopMeasure();

		expect(manager.isMeasuring).toBe(false);
		expect(manager.measureType).toBe(null);
		expect(mockMap.removeInteraction).toHaveBeenCalled();
	});

	test('stopMeasure is safe to call when not measuring', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		expect(() => manager.stopMeasure()).not.toThrow();
	});

	test('cleanup removes layer and resets all state', () => {
		const mockMap = createMockMap();
		manager.initialize(mockMap);
		manager.startMeasure('distance');

		manager.cleanup();

		expect(manager.isMeasuring).toBe(false);
		expect(manager.measureType).toBe(null);
		expect(mockMap.removeLayer).toHaveBeenCalled();
	});

	test('cleanup is safe to call without initialization', () => {
		expect(() => manager.cleanup()).not.toThrow();
	});
});

describe('MapMeasureManager.formatLength', () => {
	test('formats short distances in meters', () => {
		const result = MapMeasureManager.formatLength(42.567);
		expect(result).toBe('42.57 m');
	});

	test('formats long distances in kilometers', () => {
		const result = MapMeasureManager.formatLength(1500);
		expect(result).toBe('1.5 km');
	});

	test('formats distances at boundary (100m) as kilometers', () => {
		const result = MapMeasureManager.formatLength(100);
		expect(result).toBe('0.1 km');
	});

	test('formats zero distance', () => {
		const result = MapMeasureManager.formatLength(0);
		expect(result).toBe('0 m');
	});
});

describe('MapMeasureManager.formatArea', () => {
	test('formats small areas in square meters', () => {
		const result = MapMeasureManager.formatArea(250.5);
		expect(result).toBe('250.5 m²');
	});

	test('formats large areas in square kilometers', () => {
		const result = MapMeasureManager.formatArea(1500000);
		expect(result).toBe('1.5 km²');
	});

	test('formats areas at boundary (10000m²) as square kilometers', () => {
		const result = MapMeasureManager.formatArea(10000);
		expect(result).toBe('0.01 km²');
	});

	test('formats zero area', () => {
		const result = MapMeasureManager.formatArea(0);
		expect(result).toBe('0 m²');
	});
});
