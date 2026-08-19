// frontend/src/lib/map/featureReconstructor.test.js
import type { SerializedFeature } from './featureReconstructor.js';
import type LineString from 'ol/geom/LineString';
import type Point from 'ol/geom/Point';
import { describe, expect, test } from 'vitest';

import { reconstructFeatures } from './featureReconstructor.js';

describe('reconstructFeatures', () => {
	test('should reconstruct point features', () => {
		const serialized: SerializedFeature[] = [
			{
				id: 'node-1',
				properties: { name: 'Test Node', uuid: 'abc-123' },
				flatCoordinates: [100, 200],
				geometryLayout: 'XY',
				geometryType: 'Point'
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		expect(features[0].getId()).toBe('node-1');
		expect(features[0].get('name')).toBe('Test Node');
		const pointGeom = features[0].getGeometry() as Point;
		expect(pointGeom.getType()).toBe('Point');
		expect(pointGeom.getCoordinates()).toEqual([100, 200]);
	});

	test('should reconstruct linestring features', () => {
		const serialized: SerializedFeature[] = [
			{
				id: 'trench-1',
				properties: { length: 100 },
				flatCoordinates: [0, 0, 100, 100, 200, 200],
				geometryLayout: 'XY',
				geometryType: 'LineString'
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		const lineGeom = features[0].getGeometry() as LineString;
		expect(lineGeom.getType()).toBe('LineString');
		expect(lineGeom.getCoordinates()).toEqual([
			[0, 0],
			[100, 100],
			[200, 200]
		]);
	});

	test('should reconstruct polygon features', () => {
		const serialized: SerializedFeature[] = [
			{
				id: 'area-1',
				properties: { area_type: 'zone' },
				flatCoordinates: [0, 0, 100, 0, 100, 100, 0, 100, 0, 0],
				geometryLayout: 'XY',
				geometryType: 'Polygon',
				ends: [10] // 5 coordinates * 2 = 10
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		const polygonGeom = features[0].getGeometry();
		expect(polygonGeom?.getType()).toBe('Polygon');
	});

	test('should handle empty array', () => {
		const features = reconstructFeatures([]);
		expect(features).toEqual([]);
	});

	test('should handle features without geometry', () => {
		const serialized: SerializedFeature[] = [
			{
				id: 'feature-1',
				properties: { name: 'No Geometry' },
				flatCoordinates: undefined,
				geometryLayout: undefined,
				geometryType: undefined
			}
		];

		const features = reconstructFeatures(serialized);
		expect(features).toHaveLength(1);
		expect(features[0].getGeometry()).toBeUndefined();
	});
});
