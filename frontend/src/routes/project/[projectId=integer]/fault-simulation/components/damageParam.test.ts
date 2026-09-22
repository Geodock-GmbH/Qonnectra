import { describe, expect, test } from 'vitest';

import { formatDamage, queryDamage } from './damageParam';

function url(search = ''): URL {
	return new URL(`http://localhost/project/5/fault-simulation${search}`);
}

describe('queryDamage', () => {
	test('should read the location, rounded to whole metres', () => {
		expect(queryDamage(url('?damage=563210.4,5934120.6'))).toEqual([563210, 5934121]);
	});

	test('should treat a missing or malformed value as no damage', () => {
		expect(queryDamage(url())).toBeNull();
		expect(queryDamage(url('?damage='))).toBeNull();
		expect(queryDamage(url('?damage=abc'))).toBeNull();
		expect(queryDamage(url('?damage=1,2,3'))).toBeNull();
		expect(queryDamage(url('?damage=1,'))).toBeNull();
		expect(queryDamage(url('?damage=Infinity,2'))).toBeNull();
	});
});

describe('formatDamage', () => {
	test('should round trip through queryDamage', () => {
		expect(queryDamage(url(`?damage=${formatDamage([563210.4, 5934120.6])}`))).toEqual([
			563210, 5934121
		]);
	});
});
