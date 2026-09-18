import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { describe, expect, test } from 'vitest';

import { toAreaFeatures, toWgs84Polygon } from './inquiryGeometry';

const SQUARE = {
	type: 'Polygon' as const,
	coordinates: [
		[
			[0, 0],
			[0, 50],
			[50, 50],
			[0, 0]
		]
	]
};

describe('toAreaFeatures', () => {
	test('should carry uuid and name as feature properties', () => {
		const features = toAreaFeatures([{ uuid: 'area-1', name: 'North field', geometry: SQUARE }]);

		expect(features).toEqual([
			{
				type: 'Feature',
				properties: { uuid: 'area-1', name: 'North field' },
				geometry: SQUARE
			}
		]);
	});

	test('should skip areas without a geometry', () => {
		const features = toAreaFeatures([
			{ uuid: 'area-1', name: null, geometry: null },
			{ uuid: 'area-2', name: null, geometry: SQUARE }
		]);

		expect(features.map((feature) => feature.properties.uuid)).toEqual(['area-2']);
	});
});

describe('toWgs84Polygon', () => {
	test('should write the polygon in EPSG:4326 from the map projection', () => {
		const feature = new Feature(
			new Polygon([
				[
					[0, 0],
					[0, 111319.49079327357],
					[111319.49079327357, 111319.49079327357],
					[0, 0]
				]
			])
		);

		const polygon = toWgs84Polygon(feature, 'EPSG:3857');

		expect(polygon?.type).toBe('Polygon');
		const ring = polygon?.coordinates[0] ?? [];
		expect(ring).toHaveLength(4);
		expect(ring[0][0]).toBeCloseTo(0);
		expect(ring[0][1]).toBeCloseTo(0);
		expect(ring[2][0]).toBeCloseTo(1, 5);
		expect(ring[2][1]).toBeCloseTo(1, 3);
	});

	test('should return null for a feature that is not a polygon', () => {
		expect(toWgs84Polygon(new Feature(new Point([0, 0])), 'EPSG:3857')).toBeNull();
	});

	test('should return null for a feature without a geometry', () => {
		expect(toWgs84Polygon(new Feature(), 'EPSG:3857')).toBeNull();
	});
});
