import { describe, expect, test } from 'vitest';

import { formatAddressSearchResult, mapAddressSearchResults } from './address-search-data';

const hit = {
	uuid: 'addr-1',
	id_address: 'ABC1234',
	street: 'Main St',
	housenumber: 12,
	house_number_suffix: 'a',
	zip_code: '10115',
	city: 'Berlin'
};

describe('mapAddressSearchResults', () => {
	test('should map the results of the trace-search payload', () => {
		expect(mapAddressSearchResults({ results: [hit] })).toEqual([hit]);
	});

	test('should default missing text fields and keep a missing house number null', () => {
		expect(mapAddressSearchResults({ results: [{ uuid: 'addr-2', street: null }] })).toEqual([
			{
				uuid: 'addr-2',
				id_address: '',
				street: '',
				housenumber: null,
				house_number_suffix: '',
				zip_code: '',
				city: ''
			}
		]);
	});

	test('should drop hits without a uuid', () => {
		expect(mapAddressSearchResults({ results: [{ street: 'Nowhere' }, hit] })).toEqual([hit]);
	});

	test('should return no results for a payload without a results list', () => {
		expect(mapAddressSearchResults({})).toEqual([]);
		expect(mapAddressSearchResults(null)).toEqual([]);
		expect(mapAddressSearchResults({ results: 'oops' })).toEqual([]);
	});
});

describe('formatAddressSearchResult', () => {
	test('should join street, house number with suffix and locality', () => {
		expect(formatAddressSearchResult(hit)).toBe('Main St, 12a, 10115 Berlin');
	});

	test('should skip the parts an address does not carry', () => {
		expect(
			formatAddressSearchResult({
				...hit,
				housenumber: null,
				house_number_suffix: '',
				zip_code: ''
			})
		).toBe('Main St, Berlin');
	});

	test('should fall back to the short uuid for an address without text', () => {
		expect(
			formatAddressSearchResult({
				uuid: '0123456789abcdef',
				id_address: '',
				street: '',
				housenumber: null,
				house_number_suffix: '',
				zip_code: '',
				city: ''
			})
		).toBe('01234567');
	});
});
