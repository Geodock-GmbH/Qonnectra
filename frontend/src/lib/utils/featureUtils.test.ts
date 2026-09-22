import type { FeatureLike } from 'ol/Feature';
import type Layer from 'ol/layer/Layer';
import { describe, expect, test } from 'vitest';

import { detectFeatureType, getFieldLabel } from './featureUtils';

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

describe('getFieldLabel', () => {
	test('should convert snake_case to Title Case', () => {
		expect(getFieldLabel('construction_depth')).toBe('Construction Depth');
	});

	test('should capitalize a single word', () => {
		expect(getFieldLabel('status')).toBe('Status');
	});
});
