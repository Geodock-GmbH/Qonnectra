import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultDashboardData } from '$lib/remote/dashboard/dashboard-data';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import OverviewTab from './OverviewTab.svelte';

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
		props: { component: OverviewTab, props: { projectId: '7', flagId: '3' } }
	});
}

beforeEach(() => {
	getDashboardStatistics.mockReset();
});

describe('OverviewTab', () => {
	test('should query the statistics of the given project', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		renderTab();

		await screen.findByText('form_trench_statistics');
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7', flagId: '3' });
	});

	test('should show the headline totals of every card', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			totalLength: 12500,
			nodesByType: [
				{ node_type: 'POP', count: 2 },
				{ node_type: 'NVT', count: 5 }
			],
			conduitLengthByType: [
				{ type_name: 'DA 50', total: 3000 },
				{ type_name: 'DA 110', total: 1250 }
			],
			totalAddresses: 40,
			totalUnits: 65,
			areaCount: 3,
			totalCoverageKm2: 1.5
		});
		renderTab();

		expect(await screen.findByText('12,50')).toBeInTheDocument();
		expect(screen.getByText('7x')).toBeInTheDocument();
		expect(screen.getByText('4,25')).toBeInTheDocument();
		expect(screen.getByText('40x')).toBeInTheDocument();
		expect(screen.getByText('65x')).toBeInTheDocument();
		expect(screen.getByText('3x')).toBeInTheDocument();
		expect(screen.getByText('1,50')).toBeInTheDocument();
	});

	test('should list the trench breakdown with construction type, surface and length', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			lengthByTypes: [{ bauweise: 'offen', oberfläche: 'Asphalt', gesamt_länge: 1500 }]
		});
		renderTab();

		expect(await screen.findByText('offen')).toBeInTheDocument();
		expect(screen.getByText('Asphalt')).toBeInTheDocument();
		expect(screen.getByText('1,50 km')).toBeInTheDocument();
	});

	test('should label cities without a name as unknown', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			addressesByCity: [{ city: null, count: 9 }]
		});
		renderTab();

		expect(await screen.findByText('common_unknown')).toBeInTheDocument();
		expect(screen.getByText('9x')).toBeInTheDocument();
	});

	test('should show the expiring warranties', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			expiringWarranties: [
				{
					id: 'n1',
					name: 'PoP Mitte',
					node_type: 'POP',
					warranty: '2026-12-01',
					days_until_expiry: 74
				}
			]
		});
		renderTab();

		expect(await screen.findByText('PoP Mitte')).toBeInTheDocument();
		expect(screen.queryByText('form_no_warranties_expiring')).not.toBeInTheDocument();
	});

	test('should say so when no warranty is expiring', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		renderTab();

		expect(await screen.findByText('form_no_warranties_expiring')).toBeInTheDocument();
	});
});
