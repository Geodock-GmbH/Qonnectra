import type Geometry from 'ol/geom/Geometry';
import type VectorLayer from 'ol/layer/Vector';
import type OlMap from 'ol/Map';
import type VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	createHighlightLayer,
	debounce,
	parseFeatureGeometry,
	parseMultipleFeatureGeometries,
	zoomToExtent,
	zoomToFeature,
	zoomToMultipleFeatures
} from './searchUtils';

const pointFeature = {
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [10, 20] },
	properties: {}
};

interface FitCall {
	extent: number[];
	options: { duration: number; padding: number[]; maxZoom: number; callback?: () => void };
}

function makeMapStub(): { map: OlMap; fitCalls: FitCall[] } {
	const fitCalls: FitCall[] = [];
	const map = {
		getView: () => ({
			fit: (extent: number[], options: FitCall['options']) => {
				fitCalls.push({ extent, options });
				options.callback?.();
			}
		})
	} as unknown as OlMap;
	return { map, fitCalls };
}

function makeHighlightLayerStub() {
	const features = new Set<unknown>();
	const source = {
		addFeature: vi.fn((feature: unknown) => features.add(feature)),
		removeFeature: vi.fn((feature: unknown) => features.delete(feature)),
		hasFeature: vi.fn((feature: unknown) => features.has(feature))
	};
	const layer = { getSource: () => source } as unknown as VectorLayer<VectorSource>;
	return { layer, source, features };
}

describe('createHighlightLayer', () => {
	test('should create a marked vector layer with the given style', async () => {
		const style = new Style();

		const layer = await createHighlightLayer(style);

		expect(layer.get('isHighlightLayer')).toBe(true);
		expect(layer.getZIndex()).toBe(1000);
		expect(layer.getStyle()).toBe(style);
		expect(layer.getSource()).not.toBeNull();
	});
});

describe('parseFeatureGeometry', () => {
	test('should parse a GeoJSON feature into an OL geometry', async () => {
		const geometry = await parseFeatureGeometry(pointFeature, 'EPSG:4326');

		expect(geometry?.getType()).toBe('Point');
		expect((geometry as { getCoordinates(): number[] }).getCoordinates()).toEqual([10, 20]);
	});

	test('should reproject when a target projection is given', async () => {
		const geometry = await parseFeatureGeometry(pointFeature, 'EPSG:4326', 'EPSG:3857');

		const [x, y] = (geometry as { getCoordinates(): number[] }).getCoordinates();
		expect(x).toBeCloseTo(1113194.9, 0);
		expect(y).toBeCloseTo(2273030.9, 0);
	});
});

describe('parseMultipleFeatureGeometries', () => {
	test('should parse all features', async () => {
		const lineFeature = {
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [
					[0, 0],
					[1, 1]
				]
			},
			properties: {}
		};

		const geometries = await parseMultipleFeatureGeometries(
			[pointFeature, lineFeature],
			'EPSG:4326'
		);

		expect(geometries).toHaveLength(2);
		expect(geometries[0]?.getType()).toBe('Point');
		expect(geometries[1]?.getType()).toBe('LineString');
	});
});

describe('zoomToExtent', () => {
	test('should fit the view to the extent with default options', () => {
		const { map, fitCalls } = makeMapStub();

		zoomToExtent(map, [0, 0, 100, 100]);

		expect(fitCalls[0].extent).toEqual([0, 0, 100, 100]);
		expect(fitCalls[0].options).toEqual({
			duration: 800,
			padding: [50, 50, 50, 50],
			maxZoom: 18
		});
	});

	test('should apply custom options', () => {
		const { map, fitCalls } = makeMapStub();

		zoomToExtent(map, [0, 0, 100, 100], { duration: 0, maxZoom: 12, padding: [10, 10, 10, 10] });

		expect(fitCalls[0].options).toEqual({
			duration: 0,
			padding: [10, 10, 10, 10],
			maxZoom: 12
		});
	});
});

describe('zoomToFeature', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('should fit the view to the geometry extent and blink the highlight', async () => {
		const { map, fitCalls } = makeMapStub();
		const { layer, source, features } = makeHighlightLayerStub();
		const geometry = await parseFeatureGeometry(pointFeature, 'EPSG:4326');

		await zoomToFeature(map, geometry as Geometry, layer, { blinkCount: 4 });

		expect(fitCalls[0].extent).toEqual(geometry?.getExtent());

		await vi.advanceTimersByTimeAsync(300 * 4);

		expect(source.addFeature).toHaveBeenCalledTimes(2);
		expect(source.removeFeature).toHaveBeenCalledTimes(3);
		expect(features.size).toBe(0);
	});
});

describe('zoomToMultipleFeatures', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('should fit the view to the combined extent and leave highlights visible', async () => {
		const { map, fitCalls } = makeMapStub();
		const { layer, source, features } = makeHighlightLayerStub();
		const first = await parseFeatureGeometry(pointFeature, 'EPSG:4326');
		const second = await parseFeatureGeometry(
			{ type: 'Feature', geometry: { type: 'Point', coordinates: [30, 40] }, properties: {} },
			'EPSG:4326'
		);

		await zoomToMultipleFeatures(map, [first, second] as Geometry[], layer, { blinkCount: 4 });

		expect(fitCalls[0].extent).toEqual([10, 20, 30, 40]);

		await vi.advanceTimersByTimeAsync(300 * 4);

		// After blinking, all features stay visible
		expect(features.size).toBe(2);
	});
});

describe('debounce', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('should only invoke the function once after rapid calls', () => {
		const callback = vi.fn();
		const debounced = debounce(callback, 200);

		debounced('a');
		debounced('b');
		debounced('c');

		vi.advanceTimersByTime(200);

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith('c');
	});

	test('should invoke again for calls after the wait period', () => {
		const callback = vi.fn();
		const debounced = debounce(callback, 200);

		debounced('first');
		vi.advanceTimersByTime(200);
		debounced('second');
		vi.advanceTimersByTime(200);

		expect(callback).toHaveBeenCalledTimes(2);
	});
});
