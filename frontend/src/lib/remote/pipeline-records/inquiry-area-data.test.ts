import type { PolygonGeometry } from './inquiry-area-data';
import { describe, expect, test } from 'vitest';

import {
	buildAreaCreateBody,
	buildAreaGeometryPatch,
	buildAreaRenamePatch,
	mapInquiryArea,
	mapInquiryAreas
} from './inquiry-area-data';

const SQUARE: PolygonGeometry = {
	type: 'Polygon',
	coordinates: [
		[
			[0, 0],
			[0, 50],
			[50, 50],
			[0, 0]
		]
	]
};

describe('mapInquiryArea', () => {
	test('should take the feature id as uuid and flatten name and geometry', () => {
		const area = mapInquiryArea({
			type: 'Feature',
			id: 'area-1',
			geometry: SQUARE,
			properties: { name: 'North field' }
		});

		expect(area).toEqual({ uuid: 'area-1', name: 'North field', geometry: SQUARE });
	});

	test('should default a missing name and geometry to null', () => {
		expect(mapInquiryArea({ id: 'area-2', properties: {} })).toEqual({
			uuid: 'area-2',
			name: null,
			geometry: null
		});
	});
});

describe('mapInquiryAreas', () => {
	test('should map every feature of the collection', () => {
		const areas = mapInquiryAreas({
			features: [
				{ id: 'area-1', geometry: SQUARE, properties: { name: 'A' } },
				{ id: 'area-2', geometry: SQUARE, properties: { name: null } }
			]
		});

		expect(areas.map((area) => area.uuid)).toEqual(['area-1', 'area-2']);
	});

	test('should return an empty list when the collection has no features', () => {
		expect(mapInquiryAreas({})).toEqual([]);
	});
});

describe('write bodies', () => {
	test('should create an unnamed area under its pipeline record', () => {
		expect(buildAreaCreateBody('rec-1', SQUARE)).toEqual({
			pipeline_record: 'rec-1',
			name: null,
			geom: SQUARE
		});
	});

	test('should patch the geometry as a GeoJSON feature without touching properties', () => {
		expect(buildAreaGeometryPatch(SQUARE)).toEqual({
			type: 'Feature',
			geometry: SQUARE,
			properties: {}
		});
	});

	test('should patch only the name when renaming', () => {
		expect(buildAreaRenamePatch('North field')).toEqual({
			type: 'Feature',
			properties: { name: 'North field' }
		});
	});
});
