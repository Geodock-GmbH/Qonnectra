import { describe, expect, test, vi } from 'vitest';

import { toOptions } from './attribute-options';

vi.mock('$env/static/private', () => ({ API_URL: 'http://backend/' }));

describe('toOptions', () => {
	test('should map id/label pairs from the given key', () => {
		expect(toOptions([{ id: 1, status: 'Planned' }], 'status')).toEqual([
			{ value: 1, label: 'Planned' }
		]);
	});

	test('should fall back to an empty label when the key is missing', () => {
		expect(toOptions([{ id: 2 }], 'status')).toEqual([{ value: 2, label: '' }]);
	});
});
