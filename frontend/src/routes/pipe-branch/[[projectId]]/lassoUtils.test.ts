import { describe, expect, test } from 'vitest';

import { getSvgPathFromStroke, pathOptions, pointsToPath } from './lassoUtils';

describe('pathOptions', () => {
	test('should expose the expected default stroke configuration', () => {
		expect(pathOptions.size).toBe(7);
		expect(pathOptions.thinning).toBe(0.5);
		expect(pathOptions.smoothing).toBe(0.5);
		expect(pathOptions.streamline).toBe(0.5);
	});

	test('should use a linear easing function', () => {
		expect(pathOptions.easing?.(0.42)).toBe(0.42);
	});

	test('should taper the end but not the start', () => {
		expect(pathOptions.start).toMatchObject({ taper: 0, cap: true });
		expect(pathOptions.end).toMatchObject({ taper: 0.1, cap: true });
		expect(pathOptions.start?.easing?.(0.3)).toBe(0.3);
		expect(pathOptions.end?.easing?.(0.7)).toBe(0.7);
	});
});

describe('getSvgPathFromStroke', () => {
	test('should return an empty string for an empty stroke', () => {
		expect(getSvgPathFromStroke([])).toBe('');
	});

	test('should build a closed quadratic path from a single point', () => {
		// With one point the "next" point wraps around to itself.
		const result = getSvgPathFromStroke([[10, 20]]);
		// M 10 20 Q 10 20 , 10 20 Z
		expect(result).toBe('M 10 20 Q 10 20 , 10 20 Z');
	});

	test('should build a closed quadratic path from multiple points', () => {
		const result = getSvgPathFromStroke([
			[0, 0],
			[10, 0],
			[10, 10]
		]);
		// Prefix: M 0 0 Q
		// point 0 -> next point 1 (10,0): x0=0 y0=0 midpoint (5,0)
		// point 1 -> next point 2 (10,10): x0=10 y0=0 midpoint (10,5)
		// point 2 -> next point 0 (0,0): x0=10 y0=10 midpoint (5,5)
		expect(result).toBe('M 0 0 Q 0 0 , 5 0 10 0 , 10 5 10 10 , 5 5 Z');
	});

	test('should always start with M and terminate with Z', () => {
		const result = getSvgPathFromStroke([
			[1, 2],
			[3, 4]
		]);
		expect(result.startsWith('M 1 2 Q')).toBe(true);
		expect(result.endsWith('Z')).toBe(true);
	});

	test('should compute midpoints as the average of consecutive points', () => {
		const result = getSvgPathFromStroke([
			[0, 0],
			[4, 8]
		]);
		// midpoint between (0,0) and (4,8) is (2,4); wrap midpoint is same
		expect(result).toBe('M 0 0 Q 0 0 , 2 4 4 8 , 2 4 Z');
	});
});

describe('pointsToPath', () => {
	test('should return a valid closed SVG path for pointer input', () => {
		const points = [
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10]
		];
		const path = pointsToPath(points);
		expect(typeof path).toBe('string');
		expect(path.startsWith('M ')).toBe(true);
		expect(path.trim().endsWith('Z')).toBe(true);
		expect(path).toContain('Q');
	});

	test('should produce a non-empty path from a real freehand stroke', () => {
		const points = [
			[5, 5],
			[6, 8],
			[9, 12],
			[15, 15]
		];
		const path = pointsToPath(points, 1);
		expect(path.length).toBeGreaterThan(0);
		// A freehand stroke of several points should generate many curve segments.
		expect(path.split('Q').length).toBeGreaterThanOrEqual(2);
	});

	test('should return an empty path for empty input', () => {
		expect(pointsToPath([])).toBe('');
	});

	test('should scale stroke width by zoom, changing the generated outline', () => {
		const points = [
			[0, 0],
			[20, 0],
			[20, 20],
			[0, 20]
		];
		const thin = pointsToPath(points, 0.5);
		const thick = pointsToPath(points, 4);
		// Different stroke sizes yield different outline geometry.
		expect(thin).not.toBe(thick);
		expect(thin.length).toBeGreaterThan(0);
		expect(thick.length).toBeGreaterThan(0);
	});

	test('should default zoom to 1 when omitted', () => {
		const points = [
			[0, 0],
			[10, 5],
			[20, 0]
		];
		expect(pointsToPath(points)).toBe(pointsToPath(points, 1));
	});
});
