import proj4 from 'proj4';
import { describe, expect, test, vi } from 'vitest';

import { registerStorageProjection, storageProjection } from './projectionUtils';

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
