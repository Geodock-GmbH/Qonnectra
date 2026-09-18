import { describe, expect, test } from 'vitest';

import { mapConduitOptions } from './conduit-options';

describe('mapConduitOptions', () => {
	test('labels each conduit with its name and type', () => {
		const options = mapConduitOptions([{ uuid: 'c-1', name: 'Rohr 1', conduit_type: '7x10' }]);

		expect(options).toEqual([{ value: 'c-1', label: 'Rohr 1 (7x10)' }]);
	});

	test('omits the brackets for a conduit without a type', () => {
		expect(mapConduitOptions([{ uuid: 'c-1', name: 'Rohr 1', conduit_type: null }])).toEqual([
			{ value: 'c-1', label: 'Rohr 1' }
		]);
	});

	test('unwraps a paginated body', () => {
		const body = { results: [{ uuid: 'c-1', name: 'Rohr 1', conduit_type: '7x10' }] };

		expect(mapConduitOptions(body)).toHaveLength(1);
	});

	test('drops rows without a uuid and tolerates junk', () => {
		expect(mapConduitOptions([{ name: 'Rohr 1' }, null])).toEqual([]);
		expect(mapConduitOptions({ detail: 'nope' })).toEqual([]);
	});
});
