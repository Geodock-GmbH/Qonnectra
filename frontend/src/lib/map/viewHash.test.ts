import { describe, expect, test } from 'vitest';

import { formatViewHash, parseViewHash, sameView, withViewHash } from './viewHash';

describe('parseViewHash', () => {
	test('should read zoom and centre from a map hash', () => {
		expect(parseViewHash('#map=17.2/918200/6647800')).toEqual({
			zoom: 17.2,
			center: [918200, 6647800]
		});
	});

	test('should round the zoom to one decimal and the centre to metres', () => {
		expect(parseViewHash('map=17.26/918200.4/6647800.6')).toEqual({
			zoom: 17.3,
			center: [918200, 6647801]
		});
	});

	test('should ignore other hash content', () => {
		expect(parseViewHash('#foo=1&map=12/1/2&bar')).toEqual({ zoom: 12, center: [1, 2] });
	});

	test('should treat a missing or malformed view as none', () => {
		expect(parseViewHash('')).toBeNull();
		expect(parseViewHash('#foo=1')).toBeNull();
		expect(parseViewHash('#map=12/1')).toBeNull();
		expect(parseViewHash('#map=12/1/2/3')).toBeNull();
		expect(parseViewHash('#map=abc/1/2')).toBeNull();
		expect(parseViewHash('#map=12//2')).toBeNull();
		expect(parseViewHash('#map=Infinity/1/2')).toBeNull();
	});
});

describe('formatViewHash', () => {
	test('should round trip through parseViewHash', () => {
		const view = { zoom: 15.4, center: [918200, 6647800] as [number, number] };

		expect(parseViewHash(`#${formatViewHash(view)}`)).toEqual(view);
	});

	test('should round the values', () => {
		expect(formatViewHash({ zoom: 15.44, center: [1.4, 2.6] })).toBe('map=15.4/1/3');
	});
});

describe('withViewHash', () => {
	test('should add the view to an empty hash', () => {
		expect(withViewHash('', { zoom: 12, center: [1, 2] })).toBe('#map=12/1/2');
	});

	test('should replace an existing view and keep other parts', () => {
		expect(withViewHash('#foo=1&map=10/0/0', { zoom: 12, center: [1, 2] })).toBe(
			'#map=12/1/2&foo=1'
		);
	});
});

describe('sameView', () => {
	test('should accept differences within the hash rounding', () => {
		expect(sameView({ zoom: 12, center: [1, 2] }, { zoom: 12.04, center: [1.4, 2.4] })).toBe(true);
	});

	test('should reject a real move', () => {
		expect(sameView({ zoom: 12, center: [1, 2] }, { zoom: 12.1, center: [1, 2] })).toBe(false);
		expect(sameView({ zoom: 12, center: [1, 2] }, { zoom: 12, center: [3, 2] })).toBe(false);
	});
});
