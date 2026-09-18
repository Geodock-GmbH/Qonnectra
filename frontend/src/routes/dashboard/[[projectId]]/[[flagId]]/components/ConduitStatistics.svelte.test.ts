import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultDashboardData } from '$lib/remote/dashboard/dashboard-data';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import ConduitStatistics from './ConduitStatistics.svelte';

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
		props: { component: ConduitStatistics, props: { projectId: '7' } }
	});
}

beforeEach(() => {
	getDashboardStatistics.mockReset();
});

describe('ConduitStatistics', () => {
	test('should render every conduit chart panel with empty defaults', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		renderTab();

		expect(await screen.findByText('form_length_by_conduit_type')).toBeInTheDocument();
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7' });
		expect(screen.getByText('form_length_by_status_and_type')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_network_level')).toBeInTheDocument();
		expect(screen.getByText('form_avg_length_by_type')).toBeInTheDocument();
		expect(screen.getByText('form_conduit_count_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_owner')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_manufacturer')).toBeInTheDocument();
		expect(screen.getByText('form_conduits_over_time')).toBeInTheDocument();
		expect(screen.queryByText('form_longest_5_conduits')).not.toBeInTheDocument();
	});

	test('should render a chart for each statistic with data', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			conduitLengthByType: [{ type_name: 'DA 50', total: 1500 }],
			conduitLengthByStatusType: [{ status_name: 'verlegt', type_name: 'DA 50', total: 1500 }],
			conduitCountByStatus: [{ status_name: 'verlegt', count: 3 }]
		});
		const { container } = renderTab();

		await screen.findByText('form_length_by_conduit_type');
		expect(container.querySelectorAll('canvas')).toHaveLength(3);
	});

	test('should list the longest conduits with their length in km', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			longestConduits: [{ name: 'RV-001', type_name: null, total_length: 2500 }]
		});
		renderTab();

		expect(await screen.findByText('form_longest_5_conduits')).toBeInTheDocument();
		expect(screen.getByText('RV-001')).toBeInTheDocument();
		expect(screen.getByText('common_unknown')).toBeInTheDocument();
		expect(screen.getByText('2,50 km')).toBeInTheDocument();
	});
});
