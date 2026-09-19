import { describe, expect, it } from 'vitest';

import { countValuationRates, toValuationAreas, toValuationResult } from './valuation-data';

const polygon = {
	type: 'Polygon',
	coordinates: [
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 0]
		]
	]
};

describe('toValuationAreas', () => {
	it('maps a GeoJSON feature collection to lean areas', () => {
		const areas = toValuationAreas({
			type: 'FeatureCollection',
			features: [
				{
					id: 'area-1',
					type: 'Feature',
					geometry: polygon,
					properties: { name: 'Nord', area_type: { id: 3, area_type: 'Ausbaugebiet' } }
				}
			]
		});

		expect(areas).toEqual([
			{ uuid: 'area-1', name: 'Nord', areaType: 'Ausbaugebiet', geometry: polygon }
		]);
	});

	it('falls back to the uuid property when the feature has no id', () => {
		const [area] = toValuationAreas({
			features: [{ geometry: polygon, properties: { uuid: 'area-2', name: 'Süd' } }]
		});

		expect(area.uuid).toBe('area-2');
	});

	it('keeps areas without a type or geometry', () => {
		const [area] = toValuationAreas({
			features: [{ id: 'area-3', geometry: null, properties: { name: 'Ost', area_type: null } }]
		});

		expect(area).toEqual({ uuid: 'area-3', name: 'Ost', areaType: null, geometry: null });
	});

	it('drops features that cannot be identified', () => {
		expect(
			toValuationAreas({ features: [{ geometry: polygon, properties: { name: 'X' } }] })
		).toEqual([]);
	});

	it('returns an empty list for a body without features', () => {
		expect(toValuationAreas(null)).toEqual([]);
		expect(toValuationAreas({ detail: 'nope' })).toEqual([]);
	});
});

describe('countValuationRates', () => {
	it('counts a plain list', () => {
		expect(countValuationRates([{ id: 1 }, { id: 2 }])).toBe(2);
	});

	it('reads the total of a paginated body', () => {
		expect(countValuationRates({ count: 14, results: [{ id: 1 }] })).toBe(14);
	});

	it('counts the results of a paginated body without a total', () => {
		expect(countValuationRates({ results: [{ id: 1 }] })).toBe(1);
	});

	it('returns zero for anything else', () => {
		expect(countValuationRates(null)).toBe(0);
		expect(countValuationRates({ detail: 'nope' })).toBe(0);
	});
});

describe('toValuationResult', () => {
	it('maps the backend result to the page model', () => {
		const result = toValuationResult({
			categories: [
				{
					name: 'Tiefbau',
					unit: 'per_meter',
					amount: 120.5,
					quantity: 1000,
					gp: 120500,
					is_house_connection: false
				},
				{
					name: 'Hausanschluss',
					unit: 'per_piece',
					amount: 800,
					quantity: 10,
					gp: 8000,
					is_house_connection: true
				}
			],
			total: 128500,
			cost_per_house_connection: 12850,
			cost_per_meter: 128.5,
			projection: null
		});

		expect(result).toEqual({
			categories: [
				{ name: 'Tiefbau', unit: 'per_meter', amount: 120.5, quantity: 1000, totalPrice: 120500 },
				{ name: 'Hausanschluss', unit: 'per_piece', amount: 800, quantity: 10, totalPrice: 8000 }
			],
			total: 128500,
			costPerHouseConnection: 12850,
			costPerMeter: 128.5
		});
	});

	it('reads decimal strings as numbers', () => {
		const result = toValuationResult({
			categories: [{ name: 'A', unit: 'per_meter', amount: '1.50', quantity: '2', gp: '3.00' }],
			total: '3.00',
			cost_per_house_connection: null,
			cost_per_meter: '1.50'
		});

		expect(result.categories[0]).toMatchObject({ amount: 1.5, quantity: 2, totalPrice: 3 });
		expect(result.total).toBe(3);
		expect(result.costPerMeter).toBe(1.5);
	});

	it('keeps missing key figures as null', () => {
		const result = toValuationResult({ categories: [], total: 0 });

		expect(result.costPerHouseConnection).toBeNull();
		expect(result.costPerMeter).toBeNull();
	});

	it('treats an unusable body as an empty valuation', () => {
		expect(toValuationResult(null)).toEqual({
			categories: [],
			total: 0,
			costPerHouseConnection: null,
			costPerMeter: null
		});
	});
});
