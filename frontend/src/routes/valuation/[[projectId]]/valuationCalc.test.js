import { describe, expect, test } from 'vitest';

import { computeProjection, formatCurrency, formatQuantity } from './valuationCalc.js';

describe('formatCurrency', () => {
	test('formats a number as EUR', () => {
		expect(formatCurrency(1500)).toContain('1.500');
		expect(formatCurrency(1500)).toContain('€');
	});

	test('accepts a decimal string from the backend', () => {
		expect(formatCurrency('200000.00')).toContain('200.000');
	});

	test('renders a dash for null/empty/invalid', () => {
		expect(formatCurrency(null)).toBe('–');
		expect(formatCurrency('')).toBe('–');
		expect(formatCurrency('not-a-number')).toBe('–');
	});
});

describe('formatQuantity', () => {
	test('formats a plain quantity', () => {
		expect(formatQuantity(2)).toBe('2');
	});

	test('rounds to two decimals', () => {
		expect(formatQuantity(100.129)).toContain('100,13');
	});

	test('renders a dash for null', () => {
		expect(formatQuantity(null)).toBe('–');
	});
});

describe('computeProjection', () => {
	test('base year has no increase and equals the total', () => {
		const rows = computeProjection(100, 2025, 0.025, 3);
		expect(rows[0]).toEqual({ year: 2025, netValue: 100, increase: null });
	});

	test('compounds by the yearly correction', () => {
		const rows = computeProjection(100, 2025, 0.025, 3);
		expect(rows[1].year).toBe(2026);
		expect(rows[1].netValue).toBeCloseTo(102.5, 6);
		expect(rows[1].increase).toBeCloseTo(2.5, 6);
		expect(rows[2].netValue).toBeCloseTo(105.0625, 6);
	});

	test('supports negative correction (depreciation)', () => {
		const rows = computeProjection(100, 2025, -0.1, 2);
		expect(rows[1].netValue).toBeCloseTo(90, 6);
		expect(rows[1].increase).toBeCloseTo(-10, 6);
	});

	test('produces the requested number of years', () => {
		expect(computeProjection(100, 2025, 0.01, 22)).toHaveLength(22);
	});
});
