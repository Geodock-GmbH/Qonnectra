import proj4 from 'proj4';
import { describe, expect, test, vi } from 'vitest';

import {
	formatLatLon,
	formatStorageCoordinates,
	registerStorageProjection,
	storageProjection,
	storageReadOptions
} from './projectionUtils';

const ETRS89_UTM32_DEF = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

describe('storageProjection', () => {
	test('should build the EPSG code string for a SRID', () => {
		expect(storageProjection(25832)).toBe('EPSG:25832');
	});
});

describe('registerStorageProjection', () => {
	test('should register the projection definition with proj4', () => {
		registerStorageProjection(25832, ETRS89_UTM32_DEF);

		expect(proj4.defs('EPSG:25832')).toBeDefined();
	});

	test('should not re-register the same SRID twice', () => {
		registerStorageProjection(25832, ETRS89_UTM32_DEF);

		const defsSpy = vi.spyOn(proj4, 'defs');
		registerStorageProjection(25832, ETRS89_UTM32_DEF);

		expect(defsSpy).not.toHaveBeenCalledWith('EPSG:25832', expect.anything());
		defsSpy.mockRestore();
	});
});

describe('formatLatLon', () => {
	test('should format an EPSG:3857 point as latitude, longitude', () => {
		expect(formatLatLon([0, 0])).toBe('0.000000, 0.000000');
		expect(formatLatLon([1001875.417139, 6800125.454397])).toBe('52.000000, 9.000000');
	});
});

describe('formatStorageCoordinates', () => {
	test('should format an EPSG:3857 point as x, y in the storage SRID', () => {
		// 9°E is the central meridian of UTM zone 32, so the easting is the false easting.
		const [x, y] = formatStorageCoordinates(
			[1001875.417139, 6800125.454397],
			25832,
			ETRS89_UTM32_DEF
		)
			.split(', ')
			.map(Number);

		expect(x).toBeCloseTo(500000, 1);
		expect(y).toBeCloseTo(5761038.2, 0);
	});
});

describe('storageReadOptions', () => {
	test('should reproject from the storage projection into the view', () => {
		const options = storageReadOptions({ srid: 25832, proj4Def: ETRS89_UTM32_DEF }, 'EPSG:3857');

		expect(options).toEqual({ dataProjection: 'EPSG:25832', featureProjection: 'EPSG:3857' });
		expect(proj4.defs('EPSG:25832')).toBeDefined();
	});

	test('should read geometries as they are without a storage projection', () => {
		expect(storageReadOptions(null, 'EPSG:3857')).toEqual({});
	});
});
