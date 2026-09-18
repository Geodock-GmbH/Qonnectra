import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultDashboardData } from '$lib/remote/dashboard/dashboard-data';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import NodeStatistics from './NodeStatistics.svelte';

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
		props: { component: NodeStatistics, props: { projectId: '7' } }
	});
}

beforeEach(() => {
	getDashboardStatistics.mockReset();
});

describe('NodeStatistics', () => {
	test('should render all six node charts', async () => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			nodesByCity: [{ city: 'Preetz', count: 3 }],
			nodesByStatus: [{ status: 'aktiv', count: 2 }],
			nodesByNetworkLevel: [{ network_level: 'NE3', count: 1 }],
			nodesByType: [{ node_type: 'POP', count: 1 }],
			nodesByOwner: [{ owner: null, count: 4 }],
			newestNodes: [{ name: 'PoP-1', node_type: 'POP' }]
		});
		const { container } = renderTab();

		expect(await screen.findByText('form_nodes_by_city')).toBeInTheDocument();
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7' });
		expect(screen.getByText('form_nodes_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_nodes_by_network_level')).toBeInTheDocument();
		expect(screen.getByText('form_nodes_by_type')).toBeInTheDocument();
		expect(screen.getByText('form_nodes_by_owner')).toBeInTheDocument();
		expect(screen.getByText('form_newest_nodes')).toBeInTheDocument();
		expect(container.querySelectorAll('canvas')).toHaveLength(6);
	});

	test('should render placeholders when the statistics are empty', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		renderTab();

		expect(await screen.findAllByText('form_no_data_available')).toHaveLength(6);
	});
});
