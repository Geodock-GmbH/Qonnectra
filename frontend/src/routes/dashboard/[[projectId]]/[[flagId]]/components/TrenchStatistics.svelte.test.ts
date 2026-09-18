import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultDashboardData } from '$lib/remote/dashboard/dashboard-data';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import TrenchStatistics from './TrenchStatistics.svelte';

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
		props: { component: TrenchStatistics, props: { projectId: '7', flagId: '3' } }
	});
}

beforeEach(() => {
	getDashboardStatistics.mockReset();
});

describe('TrenchStatistics', () => {
	test('should query the statistics of the given project', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		renderTab();

		await screen.findByText('form_length_by_surface');
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7', flagId: '3' });
	});

	test('should render the trench chart panels', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			lengthByTypes: [
				{ oberfläche: 'Asphalt', bauweise: 'offen', gesamt_länge: 1500 },
				{ oberfläche: 'Asphalt', bauweise: 'geschlossen', gesamt_länge: 500 },
				{ oberfläche: 'Grünfläche', bauweise: 'offen', gesamt_länge: 1000 }
			],
			avgHouseConnectionLength: 12,
			lengthWithFunding: 2000,
			lengthWithInternalExecution: 800,
			lengthByStatus: [{ status_name: 'fertig', gesamt_länge: 3000 }],
			lengthByNetworkLevel: [{ network_level: 'NE3', gesamt_länge: 3000 }],
			longestRoutes: [
				{
					id_trench: 'T-1',
					construction_type_name: 'offen',
					surface_name: 'Asphalt',
					length: 900
				}
			]
		});
		const { container } = renderTab();

		expect(await screen.findByText('form_length_by_surface')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_construction_type')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_network_level')).toBeInTheDocument();
		expect(container.querySelectorAll('canvas')).toHaveLength(8);
	});

	test('should render placeholders for empty data', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		const { container } = renderTab();

		expect(await screen.findAllByText('form_no_data_available')).toHaveLength(8);
		expect(container.querySelector('canvas')).toBeNull();
	});

	test('should surface a failed statistics request to the boundary', async () => {
		getDashboardStatistics.mockRejectedValue(new Error('backend down'));
		renderTab();

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('backend down');
	});
});
