import { describe, expect, test } from 'vitest';

import { AddressState } from './AddressState.svelte';

const formatted = {
	value: 'addr-1',
	street: 'Hauptstraße',
	housenumber: 5,
	house_number_suffix: 'a',
	zip_code: '24211',
	city: 'Preetz',
	district: 'Mitte',
	status_development: 'geplant',
	flag: 'Bau'
};

describe('AddressState', () => {
	test('should initialize with addresses from the load function', () => {
		const state = new AddressState({ addresses: [formatted] });

		expect(state.addresses).toEqual([formatted]);
	});

	test('should initialize empty without addresses', () => {
		expect(new AddressState({}).addresses).toEqual([]);
	});

	describe('formatAddress', () => {
		test('should flatten nested API data for table display', () => {
			const state = new AddressState({});

			const result = state.formatAddress({
				uuid: 'addr-1',
				street: 'Hauptstraße',
				housenumber: 5,
				house_number_suffix: 'a',
				zip_code: '24211',
				city: 'Preetz',
				district: 'Mitte',
				status_development: { status_development: 'geplant' },
				flag: { flag: 'Bau' }
			});

			expect(result).toEqual(formatted);
		});

		test('should default missing fields to empty strings', () => {
			const state = new AddressState({});

			expect(state.formatAddress({ uuid: 'addr-2' })).toEqual({
				value: 'addr-2',
				street: '',
				housenumber: '',
				house_number_suffix: '',
				zip_code: '',
				city: '',
				district: '',
				status_development: '',
				flag: ''
			});
		});
	});

	describe('updateAddress', () => {
		test('should replace the matching address in place', () => {
			const state = new AddressState({ addresses: [formatted] });

			state.updateAddress({ uuid: 'addr-1', street: 'Neue Straße' });

			expect(state.addresses).toHaveLength(1);
			expect(state.addresses[0].street).toBe('Neue Straße');
		});

		test('should ignore updates for unknown addresses', () => {
			const state = new AddressState({ addresses: [formatted] });

			state.updateAddress({ uuid: 'unknown', street: 'X' });

			expect(state.addresses).toEqual([formatted]);
		});
	});

	test('should delete an address by id', () => {
		const state = new AddressState({ addresses: [formatted] });

		state.deleteAddress('addr-1');

		expect(state.addresses).toEqual([]);
	});

	test('should replace all addresses via setAddresses', () => {
		const state = new AddressState({ addresses: [formatted] });

		state.setAddresses([]);
		expect(state.addresses).toEqual([]);

		state.setAddresses([formatted]);
		expect(state.addresses).toEqual([formatted]);
	});
});
