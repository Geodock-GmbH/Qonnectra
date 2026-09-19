import { describe, expect, test, vi } from 'vitest';

import { searchResultLabel, searchResultSubtitle } from './searchResultLabels';

vi.mock('$lib/paraglide/messages', () => ({
	m: { form_floor: () => 'Floor' }
}));

describe('searchResultLabel', () => {
	test('should format an address as street, number and locality', () => {
		const address = {
			uuid: 'a-1',
			street: 'Main St',
			housenumber: 12,
			house_number_suffix: 'a',
			zip_code: '10115',
			city: 'Berlin'
		};

		expect(searchResultLabel('address', address)).toBe('Main St, 12a, 10115 Berlin');
	});

	test('should name nodes and cables', () => {
		expect(searchResultLabel('node', { uuid: 'n-1', name: 'POP 1' })).toBe('POP 1');
		expect(searchResultLabel('cable', { uuid: 'c-1', name: 'Cable 1' })).toBe('Cable 1');
	});

	test('should format a residential unit with its floor and side', () => {
		const unit = { uuid: 'ru-1', id_residential_unit: 'RU-7', floor: 0, side: 'left' };

		expect(searchResultLabel('residential_unit', unit)).toBe('RU-7 - Floor 0 - left');
	});

	test('should fall back to the short uuid for a hit without text', () => {
		expect(searchResultLabel('node', { uuid: '12345678-abcd' })).toBe('12345678');
	});
});

describe('searchResultSubtitle', () => {
	test('should show the address id', () => {
		expect(searchResultSubtitle('address', { uuid: 'a-1', id_address: 'ABC1234' })).toBe('ABC1234');
	});

	test('should show a type given as a string or as an object', () => {
		expect(searchResultSubtitle('node', { uuid: 'n-1', node_type: 'POP' })).toBe('POP');
		expect(searchResultSubtitle('cable', { uuid: 'c-1', cable_type: { cable_type: '48F' } })).toBe(
			'48F'
		);
	});

	test('should show the address of a residential unit', () => {
		const unit = { uuid: 'ru-1', address_street: 'Main St', address_housenumber: 12 };

		expect(searchResultSubtitle('residential_unit', unit)).toBe('Main St 12');
	});

	test('should show nothing when the hit carries no detail', () => {
		expect(searchResultSubtitle('node', { uuid: 'n-1' })).toBeNull();
	});
});
