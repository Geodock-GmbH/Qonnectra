import { describe, expect, test } from 'vitest';

import {
	DEFAULT_ADDRESS_COLOR,
	DEFAULT_ADDRESS_SIZE,
	DEFAULT_AREA_COLOR,
	DEFAULT_AREA_OPACITY,
	DEFAULT_NODE_COLOR,
	DEFAULT_NODE_SHAPE,
	DEFAULT_NODE_SIZE,
	DEFAULT_SELECTED_COLOR,
	DEFAULT_TRENCH_COLOR,
	DEFAULT_TRENCH_WIDTH,
	getNodeTypeDefault,
	NODE_TYPE_DEFAULTS
} from './defaultColors.js';

describe('defaultColors constants', () => {
	test('all color constants are valid hex codes', () => {
		const hexPattern = /^#[0-9a-f]{6}$/i;
		expect(DEFAULT_TRENCH_COLOR).toMatch(hexPattern);
		expect(DEFAULT_NODE_COLOR).toMatch(hexPattern);
		expect(DEFAULT_ADDRESS_COLOR).toMatch(hexPattern);
		expect(DEFAULT_AREA_COLOR).toMatch(hexPattern);
		expect(DEFAULT_SELECTED_COLOR).toMatch(hexPattern);
	});

	test('trench defaults match spec', () => {
		expect(DEFAULT_TRENCH_COLOR).toBe('#0033ff');
		expect(DEFAULT_TRENCH_WIDTH).toBe(2);
	});

	test('address defaults match spec', () => {
		expect(DEFAULT_ADDRESS_COLOR).toBe('#949494');
		expect(DEFAULT_ADDRESS_SIZE).toBe(4);
	});

	test('node generic defaults match spec', () => {
		expect(DEFAULT_NODE_COLOR).toBe('#ff6b35');
		expect(DEFAULT_NODE_SIZE).toBe(6);
		expect(DEFAULT_NODE_SHAPE).toBe('square');
	});

	test('area defaults match spec', () => {
		expect(DEFAULT_AREA_COLOR).toBe('#22c55e');
		expect(DEFAULT_AREA_OPACITY).toBe(0.3);
	});

	test('selected feature color is yellow', () => {
		expect(DEFAULT_SELECTED_COLOR).toBe('#fff700');
	});
});

describe('NODE_TYPE_DEFAULTS', () => {
	test('contains all specified node types', () => {
		const expectedTypes = [
			'Bauerschwernis',
			'FCC4',
			'FCC8',
			'Hausanschluss',
			'Kabelring',
			'MFG',
			'Muffe',
			'NVt 48',
			'POP',
			'Rohrabzweig',
			'Schacht'
		];
		for (const typeName of expectedTypes) {
			expect(NODE_TYPE_DEFAULTS).toHaveProperty(typeName);
		}
	});

	test('each entry has color, size, and shape', () => {
		for (const [name, config] of Object.entries(NODE_TYPE_DEFAULTS)) {
			expect(config).toHaveProperty('color');
			expect(config).toHaveProperty('size');
			expect(config).toHaveProperty('shape');
			expect(config.color).toMatch(/^#[0-9a-f]{6}$/i);
			expect(config.size).toBeGreaterThan(0);
			expect(['circle', 'square']).toContain(config.shape);
		}
	});

	test('Muffe and Schacht share the same cyan color', () => {
		expect(NODE_TYPE_DEFAULTS['Muffe'].color).toBe('#00ffe1');
		expect(NODE_TYPE_DEFAULTS['Schacht'].color).toBe('#00ffe1');
	});

	test('PoP and MFG share the same red color', () => {
		expect(NODE_TYPE_DEFAULTS['POP'].color).toBe('#ff0000');
		expect(NODE_TYPE_DEFAULTS['MFG'].color).toBe('#ff0000');
	});

	test('FCC4, FCC8 and NVt 48 share the same blue color', () => {
		expect(NODE_TYPE_DEFAULTS['FCC4'].color).toBe('#006eff');
		expect(NODE_TYPE_DEFAULTS['FCC8'].color).toBe('#006eff');
		expect(NODE_TYPE_DEFAULTS['NVt 48'].color).toBe('#006eff');
	});
});

describe('getNodeTypeDefault', () => {
	test('returns specific defaults for known node types', () => {
		expect(getNodeTypeDefault('Muffe')).toEqual({ color: '#00ffe1', size: 12, shape: 'square' });
		expect(getNodeTypeDefault('POP')).toEqual({ color: '#ff0000', size: 22, shape: 'square' });
		expect(getNodeTypeDefault('Hausanschluss')).toEqual({
			color: '#ff6b35',
			size: 6,
			shape: 'square'
		});
	});

	test('returns generic fallback for unknown node types', () => {
		expect(getNodeTypeDefault('UnknownType')).toEqual({
			color: DEFAULT_NODE_COLOR,
			size: DEFAULT_NODE_SIZE,
			shape: DEFAULT_NODE_SHAPE
		});
	});

	test('returns generic fallback for empty string', () => {
		expect(getNodeTypeDefault('')).toEqual({
			color: DEFAULT_NODE_COLOR,
			size: DEFAULT_NODE_SIZE,
			shape: DEFAULT_NODE_SHAPE
		});
	});

	test('is case-sensitive — lowercase does not match', () => {
		expect(getNodeTypeDefault('muffe')).toEqual({
			color: DEFAULT_NODE_COLOR,
			size: DEFAULT_NODE_SIZE,
			shape: DEFAULT_NODE_SHAPE
		});
	});
});
