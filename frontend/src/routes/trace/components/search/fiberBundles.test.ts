import { describe, expect, test } from 'vitest';

import { groupFibersByBundle } from './fiberBundles';

describe('groupFibersByBundle', () => {
	test('should group the fibers by bundle, ordered by bundle number', () => {
		const fibers = [
			{ uuid: 'f-3', bundle_number: 2, bundle_color: 'Blau' },
			{ uuid: 'f-1', bundle_number: 1, bundle_color: 'Rot' },
			{ uuid: 'f-2', bundle_number: 1, bundle_color: 'Rot' }
		];

		expect(groupFibersByBundle(fibers)).toEqual([
			{ bundleNumber: 1, bundleColor: 'Rot', fibers: [fibers[1], fibers[2]] },
			{ bundleNumber: 2, bundleColor: 'Blau', fibers: [fibers[0]] }
		]);
	});

	test('should return no bundles for a cable without fibers', () => {
		expect(groupFibersByBundle([])).toEqual([]);
	});
});
