import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import AddressStatistics from './AddressStatistics.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('AddressStatistics', () => {
	test('should render all four address charts', () => {
		render(AddressStatistics, {
			addressesByCity: [{ city: 'Preetz', count: 12 }],
			addressesByStatus: [{ status: 'erschlossen', count: 8 }],
			unitsByCity: [{ city: null, count: 4 }],
			unitsByType: [{ type: 'Wohnung', count: 4 }]
		});

		expect(screen.getByText('form_addresses_by_city')).toBeInTheDocument();
		expect(screen.getByText('form_addresses_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_units_by_city')).toBeInTheDocument();
		expect(screen.getByText('form_units_by_type')).toBeInTheDocument();
	});

	test('should render placeholders for empty statistics', () => {
		render(AddressStatistics, {
			addressesByCity: [],
			addressesByStatus: [],
			unitsByCity: [],
			unitsByType: []
		});

		expect(screen.getAllByText('form_no_data_available').length).toBeGreaterThanOrEqual(4);
	});
});
