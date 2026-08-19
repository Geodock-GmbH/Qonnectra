import { describe, expect, test } from 'vitest';

import {
	buildEdgePath,
	getClosestPointOnSegment,
	getPathMidpoint,
	snapToGrid
} from './edgeGeometry';

describe('getPathMidpoint', () => {
	test('should return the center of a straight segment without waypoints', () => {
		expect(getPathMidpoint(0, 0, 10, 0)).toEqual({ x: 5, y: 0 });
	});

	test('should return the center of a diagonal segment', () => {
		expect(getPathMidpoint(0, 0, 10, 10)).toEqual({ x: 5, y: 5 });
	});

	test('should place the midpoint along the full polyline length with waypoints', () => {
		// Path: (0,0) -> (10,0) -> (10,10), total length 20, midpoint at corner
		expect(getPathMidpoint(0, 0, 10, 10, [{ x: 10, y: 0 }])).toEqual({ x: 10, y: 0 });
	});

	test('should place the midpoint inside the longer segment of an uneven path', () => {
		// Path: (0,0) -> (2,0) -> (12,0), total length 12, midpoint at x=6
		expect(getPathMidpoint(0, 0, 12, 0, [{ x: 2, y: 0 }])).toEqual({ x: 6, y: 0 });
	});

	test('should return the point itself when source and target coincide', () => {
		expect(getPathMidpoint(3, 4, 3, 4)).toEqual({ x: 3, y: 4 });
	});
});

describe('getClosestPointOnSegment', () => {
	test('should project a point perpendicularly onto the segment', () => {
		const result = getClosestPointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
		expect(result).toEqual({ x: 5, y: 0, t: 0.5 });
	});

	test('should clamp to the segment start when the projection falls before it', () => {
		const result = getClosestPointOnSegment({ x: -5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
		expect(result).toEqual({ x: 0, y: 0, t: 0 });
	});

	test('should clamp to the segment end when the projection falls after it', () => {
		const result = getClosestPointOnSegment({ x: 15, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
		expect(result).toEqual({ x: 10, y: 0, t: 1 });
	});

	test('should return the start point with t=0 for a zero-length segment', () => {
		const result = getClosestPointOnSegment({ x: 5, y: 5 }, { x: 2, y: 2 }, { x: 2, y: 2 });
		expect(result).toEqual({ x: 2, y: 2, t: 0 });
	});
});

describe('snapToGrid', () => {
	test('should round coordinates to the nearest grid point when enabled', () => {
		expect(snapToGrid(12, 18, 10, true)).toEqual({ x: 10, y: 20 });
	});

	test('should return coordinates unchanged when disabled', () => {
		expect(snapToGrid(12, 18, 10, false)).toEqual({ x: 12, y: 18 });
	});

	test('should keep coordinates already on the grid', () => {
		expect(snapToGrid(20, 30, 10, true)).toEqual({ x: 20, y: 30 });
	});
});

describe('buildEdgePath', () => {
	test('should build an SVG path through the waypoints', () => {
		const path = buildEdgePath(0, 0, 30, 30, [
			{ x: 10, y: 0 },
			{ x: 10, y: 20 }
		]);
		expect(path).toBe('M 0,0 L 10,0 L 10,20 L 30,30');
	});

	test('should return null without waypoints', () => {
		expect(buildEdgePath(0, 0, 30, 30)).toBeNull();
	});

	test('should return null for an empty waypoint array', () => {
		expect(buildEdgePath(0, 0, 30, 30, [])).toBeNull();
	});

	test('should return null for a null waypoint list', () => {
		expect(buildEdgePath(0, 0, 30, 30, null)).toBeNull();
	});
});
