// frontend/src/lib/map/featureReconstructor.test.js
import { describe, expect, test } from 'vitest';

import { reconstructFeatures } from './featureReconstructor.js';

describe('reconstructFeatures', () => {
	test('should reconstruct point features', () => {
		const serialized = [
			{
				id: 'node-1',
				properties: { name: 'Test Node', uuid: 'abc-123' },
				geometryName: 'geometry',
				flatCoordinates: [100, 200],
				geometryLayout: 'XY',
				geometryType: 'Point'
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		expect(features[0].getId()).toBe('node-1');
		expect(features[0].get('name')).toBe('Test Node');
		expect(features[0].getGeometry().getType()).toBe('Point');
		expect(features[0].getGeometry().getCoordinates()).toEqual([100, 200]);
	});

	test('should reconstruct linestring features', () => {
		const serialized = [
			{
				id: 'trench-1',
				properties: { length: 100 },
				geometryName: 'geometry',
				flatCoordinates: [0, 0, 100, 100, 200, 200],
				geometryLayout: 'XY',
				geometryType: 'LineString'
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		expect(features[0].getGeometry().getType()).toBe('LineString');
		expect(features[0].getGeometry().getCoordinates()).toEqual([
			[0, 0],
			[100, 100],
			[200, 200]
		]);
	});

	test('should reconstruct polygon features', () => {
		const serialized = [
			{
				id: 'area-1',
				properties: { area_type: 'zone' },
				geometryName: 'geometry',
				flatCoordinates: [0, 0, 100, 0, 100, 100, 0, 100, 0, 0],
				geometryLayout: 'XY',
				geometryType: 'Polygon',
				ends: [10] // 5 coordinates * 2 = 10
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		expect(features[0].getGeometry().getType()).toBe('Polygon');
	});

	test('should handle empty array', () => {
		const features = reconstructFeatures([]);
		expect(features).toEqual([]);
	});

	test('should handle features without geometry', () => {
		const serialized = [
			{
				id: 'feature-1',
				properties: { name: 'No Geometry' },
				geometryName: 'geometry',
				flatCoordinates: null,
				geometryLayout: null,
				geometryType: null
			}
		];

		const features = reconstructFeatures(serialized);
		expect(features).toHaveLength(1);
		expect(features[0].getGeometry()).toBeUndefined();
	});
});
