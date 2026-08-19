import type { FeatureLike } from 'ol/Feature';
import type Layer from 'ol/layer/Layer';
import { describe, expect, test } from 'vitest';

import {
	detectFeatureType,
	formatFeatureProperties,
	getFeatureTitle,
	getFieldLabel
} from './featureUtils';

function makeFeature(properties: Record<string, unknown>): FeatureLike {
	return { getProperties: () => properties } as unknown as FeatureLike;
}

function makeLayer(values: Record<string, unknown>): Layer {
	return { get: (key: string) => values[key] } as unknown as Layer;
}

describe('detectFeatureType', () => {
	test('should return null for a missing feature', () => {
		expect(detectFeatureType(null as unknown as FeatureLike)).toBeNull();
	});

	test.each([
		['trench-layer', 'trench'],
		['address-layer', 'address'],
		['node-layer', 'node'],
		['area-layer', 'area']
	])('should detect type from layer ID %s', (layerId, expected) => {
		const feature = makeFeature({});
		expect(detectFeatureType(feature, makeLayer({ layerId }))).toBe(expected);
	});

	test.each([
		['Trench Phase 1', 'trench'],
		['address points', 'address'],
		['Node overlay', 'node'],
		['Fläche Süd', 'area']
	])('should detect type from layer name %s', (layerName, expected) => {
		const feature = makeFeature({});
		expect(detectFeatureType(feature, makeLayer({ layerName }))).toBe(expected);
	});

	test('should fall back to property heuristics when no layer is given', () => {
		expect(detectFeatureType(makeFeature({ id_trench: 'T-1' }))).toBe('trench');
		expect(detectFeatureType(makeFeature({ construction_depth: 60 }))).toBe('trench');
		expect(detectFeatureType(makeFeature({ zip_code: '24211' }))).toBe('address');
		expect(detectFeatureType(makeFeature({ node_type: 'PoP' }))).toBe('node');
		expect(detectFeatureType(makeFeature({ area_type: 'polygon' }))).toBe('area');
	});

	test('should return null when nothing matches', () => {
		expect(detectFeatureType(makeFeature({ foo: 'bar' }))).toBeNull();
	});
});

describe('formatFeatureProperties', () => {
	test('should strip internal fields and empty values', () => {
		const formatted = formatFeatureProperties(
			{
				geometry: {},
				layer: 'x',
				uuid: 'abc',
				name: 'Node 1',
				status: null,
				comment: undefined,
				length: 0
			},
			'node'
		);
		expect(formatted).toEqual({ name: 'Node 1', length: 0 });
	});

	test('should return an empty object for missing properties', () => {
		expect(formatFeatureProperties(null as unknown as Record<string, unknown>, 'node')).toEqual({});
	});
});

describe('getFeatureTitle', () => {
	test('should use the trench ID as title', () => {
		expect(getFeatureTitle(makeFeature({ id_trench: 'T-42' }), 'trench')).toBe('T-42');
	});

	test('should fall back to a generic trench title', () => {
		expect(getFeatureTitle(makeFeature({}), 'trench')).toBe('Trench Details');
	});

	test('should build a full address title from street parts', () => {
		const feature = makeFeature({
			street: 'Hauptstraße',
			housenumber: 12,
			house_number_suffix: 'a',
			zip_code: '24211',
			city: 'Preetz'
		});
		expect(getFeatureTitle(feature, 'address')).toBe('Hauptstraße 12a, 24211 Preetz');
	});

	test('should fall back to the address ID without street data', () => {
		expect(getFeatureTitle(makeFeature({ id_address: 'A-7' }), 'address')).toBe('A-7');
	});

	test('should use the node name as title', () => {
		expect(getFeatureTitle(makeFeature({ name: 'PoP-1' }), 'node')).toBe('PoP-1');
	});

	test('should use the area name as title', () => {
		expect(getFeatureTitle(makeFeature({ name: 'Süd' }), 'area')).toBe('Süd');
	});

	test('should return a generic title for a missing feature', () => {
		expect(getFeatureTitle(null as unknown as FeatureLike, 'node')).toBe('Feature Details');
	});
});

describe('getFieldLabel', () => {
	test('should convert snake_case to Title Case', () => {
		expect(getFieldLabel('construction_depth')).toBe('Construction Depth');
	});

	test('should capitalize a single word', () => {
		expect(getFieldLabel('status')).toBe('Status');
	});
});
