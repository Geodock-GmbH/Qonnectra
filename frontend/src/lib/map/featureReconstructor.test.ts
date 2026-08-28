import type { SerializedFeature } from './featureReconstructor.js';
import RenderFeature from 'ol/render/Feature.js';
import { describe, expect, test } from 'vitest';

import { reconstructFeatures } from './featureReconstructor.js';

describe('reconstructFeatures', () => {
	test('should reconstruct point features as RenderFeatures', () => {
		const serialized: SerializedFeature[] = [
			{
				id: 'node-1',
				properties: { name: 'Test Node' },
				flatCoordinates: [100, 200],
				geometryLayout: 'XY',
				geometryType: 'Point'
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		expect(features[0]).toBeInstanceOf(RenderFeature);
		expect(features[0].getId()).toBe('node-1');
		expect(features[0].get('name')).toBe('Test Node');
		expect(features[0].getType()).toBe('Point');
		expect(features[0].getFlatCoordinates()).toEqual([100, 200]);
		expect(features[0].getExtent()).toEqual([100, 200, 100, 200]);
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
		expect(features[0].getType()).toBe('LineString');
		expect(features[0].getFlatCoordinates()).toEqual([0, 0, 100, 100, 200, 200]);
		expect(features[0].getStride()).toBe(2);
	});

	test('should reconstruct polygon features with ring boundaries', () => {
		const flat = [0, 0, 100, 0, 100, 100, 0, 100, 0, 0];
		const serialized: SerializedFeature[] = [
			{
				id: 'area-1',
				properties: { area_type: 'zone' },
				flatCoordinates: flat,
				geometryLayout: 'XY',
				geometryType: 'Polygon',
				ends: [10] // 5 coordinates * 2 = 10
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features).toHaveLength(1);
		expect(features[0].getType()).toBe('Polygon');
		expect(features[0].getEnds()).toEqual([10]);
		expect(features[0].getExtent()).toEqual([0, 0, 100, 100]);
	});

	test('should strip a serialized geometry property', () => {
		const serialized: SerializedFeature[] = [
			{
				id: 'node-2',
				properties: { geometry: { some: 'blob' }, name: 'Kept' },
				flatCoordinates: [1, 2],
				geometryLayout: 'XY',
				geometryType: 'Point'
			}
		];

		const features = reconstructFeatures(serialized);

		expect(features[0].get('geometry')).toBeUndefined();
		expect(features[0].get('name')).toBe('Kept');
	});

	test('should handle empty array', () => {
		const features = reconstructFeatures([]);
		expect(features).toEqual([]);
	});

	test('should drop features without geometry', () => {
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
		expect(features).toHaveLength(0);
	});
});
