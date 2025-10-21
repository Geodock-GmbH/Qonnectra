import { describe, expect, test } from 'vitest';

import {
	buildEdgePath,
	getClosestPointOnSegment,
	getPathMidpoint,
	snapToGrid
} from '$lib/utils/edgeGeometry.js';

describe('getPathMidpoint', () => {
	test('calculates midpoint for straight line without waypoints', () => {
		const result = getPathMidpoint(0, 0, 100, 100, []);
		expect(result.x).toBeCloseTo(50);
		expect(result.y).toBeCloseTo(50);
	});

	test('calculates midpoint for straight line with null waypoints', () => {
		const result = getPathMidpoint(0, 0, 100, 0, null);
		expect(result.x).toBeCloseTo(50);
		expect(result.y).toBeCloseTo(0);
	});

	test('calculates midpoint with single waypoint', () => {
		const waypoints = [{ x: 50, y: 100 }];
		const result = getPathMidpoint(0, 0, 100, 0, waypoints);
		expect(result.x).toBeGreaterThan(0);
		expect(result.x).toBeLessThan(100);
	});

	test('calculates midpoint with multiple waypoints', () => {
		const waypoints = [
			{ x: 25, y: 25 },
			{ x: 75, y: 25 },
			{ x: 75, y: 75 }
		];
		const result = getPathMidpoint(0, 0, 100, 100, waypoints);
		expect(result).toBeDefined();
		expect(result.x).toBeGreaterThan(0);
		expect(result.x).toBeLessThan(100);
	});

	test('handles zero-length path', () => {
		const result = getPathMidpoint(50, 50, 50, 50, []);
		expect(result).toEqual({ x: 50, y: 50 });
	});
});

describe('getClosestPointOnSegment', () => {
	test('finds closest point on horizontal segment', () => {
		const p = { x: 50, y: 10 };
		const a = { x: 0, y: 0 };
		const b = { x: 100, y: 0 };
		const result = getClosestPointOnSegment(p, a, b);

		expect(result.x).toBeCloseTo(50);
		expect(result.y).toBeCloseTo(0);
		expect(result.t).toBeCloseTo(0.5);
	});

	test('finds closest point on vertical segment', () => {
		const p = { x: 10, y: 50 };
		const a = { x: 0, y: 0 };
		const b = { x: 0, y: 100 };
		const result = getClosestPointOnSegment(p, a, b);

		expect(result.x).toBeCloseTo(0);
		expect(result.y).toBeCloseTo(50);
		expect(result.t).toBeCloseTo(0.5);
	});

	test('clamps to start when point is before segment', () => {
		const p = { x: -10, y: 0 };
		const a = { x: 0, y: 0 };
		const b = { x: 100, y: 0 };
		const result = getClosestPointOnSegment(p, a, b);

		expect(result.x).toBeCloseTo(0);
		expect(result.y).toBeCloseTo(0);
		expect(result.t).toBeCloseTo(0);
	});

	test('clamps to end when point is after segment', () => {
		const p = { x: 150, y: 0 };
		const a = { x: 0, y: 0 };
		const b = { x: 100, y: 0 };
		const result = getClosestPointOnSegment(p, a, b);

		expect(result.x).toBeCloseTo(100);
		expect(result.y).toBeCloseTo(0);
		expect(result.t).toBeCloseTo(1);
	});

	test('handles zero-length segment', () => {
		const p = { x: 50, y: 50 };
		const a = { x: 0, y: 0 };
		const b = { x: 0, y: 0 };
		const result = getClosestPointOnSegment(p, a, b);

		expect(result.x).toBe(0);
		expect(result.y).toBe(0);
		expect(result.t).toBe(0);
	});

	test('finds closest point on diagonal segment', () => {
		const p = { x: 50, y: 50 };
		const a = { x: 0, y: 0 };
		const b = { x: 100, y: 100 };
		const result = getClosestPointOnSegment(p, a, b);

		expect(result.x).toBeCloseTo(50);
		expect(result.y).toBeCloseTo(50);
		expect(result.t).toBeCloseTo(0.5);
	});
});

describe('snapToGrid', () => {
	test('snaps coordinates when enabled', () => {
		const result = snapToGrid(23, 47, 20, true);
		expect(result).toEqual({ x: 20, y: 40 });
	});

	test('snaps to nearest grid point', () => {
		const result = snapToGrid(31, 69, 20, true);
		expect(result).toEqual({ x: 40, y: 60 });
	});

	test('returns original coordinates when disabled', () => {
		const result = snapToGrid(23, 47, 20, false);
		expect(result).toEqual({ x: 23, y: 47 });
	});

	test('handles exact grid coordinates', () => {
		const result = snapToGrid(40, 60, 20, true);
		expect(result).toEqual({ x: 40, y: 60 });
	});

	test('handles zero coordinates', () => {
		const result = snapToGrid(0, 0, 20, true);
		expect(result).toEqual({ x: 0, y: 0 });
	});

	test('handles negative coordinates', () => {
		const result = snapToGrid(-23, -47, 20, true);
		expect(result).toEqual({ x: -20, y: -40 });
	});

	test('works with different grid sizes', () => {
		const result = snapToGrid(25, 25, 10, true);
		expect(result).toEqual({ x: 30, y: 30 });
	});
});

describe('buildEdgePath', () => {
	test('builds path with waypoints', () => {
		const waypoints = [
			{ x: 50, y: 50 },
			{ x: 75, y: 75 }
		];
		const result = buildEdgePath(0, 0, 100, 100, waypoints);
		expect(result).toBe('M 0,0 L 50,50 L 75,75 L 100,100');
	});

	test('returns null for empty waypoints array', () => {
		const result = buildEdgePath(0, 0, 100, 100, []);
		expect(result).toBeNull();
	});

	test('returns null for null waypoints', () => {
		const result = buildEdgePath(0, 0, 100, 100, null);
		expect(result).toBeNull();
	});

	test('returns null for undefined waypoints', () => {
		const result = buildEdgePath(0, 0, 100, 100, undefined);
		expect(result).toBeNull();
	});

	test('builds path with single waypoint', () => {
		const waypoints = [{ x: 50, y: 50 }];
		const result = buildEdgePath(0, 0, 100, 100, waypoints);
		expect(result).toBe('M 0,0 L 50,50 L 100,100');
	});

	test('handles floating point coordinates', () => {
		const waypoints = [{ x: 33.33, y: 66.66 }];
		const result = buildEdgePath(0, 0, 99.99, 99.99, waypoints);
		expect(result).toBe('M 0,0 L 33.33,66.66 L 99.99,99.99');
	});

	test('handles negative coordinates', () => {
		const waypoints = [{ x: -50, y: -50 }];
		const result = buildEdgePath(-100, -100, 0, 0, waypoints);
		expect(result).toBe('M -100,-100 L -50,-50 L 0,0');
	});
});
