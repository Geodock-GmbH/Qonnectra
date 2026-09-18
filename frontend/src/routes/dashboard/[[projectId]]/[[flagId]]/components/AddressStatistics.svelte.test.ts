import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultDashboardData } from '$lib/remote/dashboard/dashboard-data';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import AddressStatistics from './AddressStatistics.svelte';

const getDashboardStatistics = vi.fn();

vi.mock('$lib/remote/dashboard/statistics.remote', () => ({
	getDashboardStatistics: (...args: unknown[]) => getDashboardStatistics(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

/**
 * Renders the tab behind a boundary, the way the dashboard page does.
 */
function renderTab() {
	return render(BoundaryFixture, {
		props: { component: AddressStatistics, props: { projectId: '7' } }
	});
}

beforeEach(() => {
	getDashboardStatistics.mockReset();
});

describe('AddressStatistics', () => {
	test('should render all four address charts', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			addressesByCity: [{ city: 'Preetz', count: 12 }],
			addressesByStatus: [{ status: 'erschlossen', count: 8 }],
			unitsByCity: [{ city: null, count: 4 }],
			unitsByType: [{ type: 'Wohnung', count: 4 }]
		});
		const { container } = renderTab();

		expect(await screen.findByText('form_addresses_by_city')).toBeInTheDocument();
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7' });
		expect(screen.getByText('form_addresses_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_units_by_city')).toBeInTheDocument();
		expect(screen.getByText('form_units_by_type')).toBeInTheDocument();
		expect(container.querySelectorAll('canvas')).toHaveLength(4);
	});

	test('should render placeholders for empty statistics', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		renderTab();

		expect(await screen.findAllByText('form_no_data_available')).toHaveLength(4);
	});
});
