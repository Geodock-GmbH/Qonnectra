import { describe, expect, test } from 'vitest';

import { transformMicropipeConnections } from './micropipe-connections';

describe('transformMicropipeConnections', () => {
	test('transforms microduct connection records', () => {
		const result = transformMicropipeConnections([
			{ uuid_microduct: { number: 3, hex_code: '#ff0000', color: 'red' } },
			{ uuid_microduct: { number: 4, color: 'green' } }
		]);

		expect(result[0]).toEqual({ number: 3, color_hex: '#ff0000', color_name: 'red' });
		// falls back to the default hex when hex_code is missing
		expect(result[1]).toEqual({ number: 4, color_hex: '#64748b', color_name: 'green' });
	});

	test('returns an empty list for no records', () => {
		expect(transformMicropipeConnections([])).toEqual([]);
	});
});
