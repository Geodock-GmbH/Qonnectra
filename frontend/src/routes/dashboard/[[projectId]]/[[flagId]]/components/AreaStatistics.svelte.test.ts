import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultDashboardData } from '$lib/remote/dashboard/dashboard-data';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import AreaStatistics from './AreaStatistics.svelte';

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
		props: { component: AreaStatistics, props: { projectId: '7' } }
	});
}

beforeEach(() => {
	getDashboardStatistics.mockReset();
});

describe('AreaStatistics', () => {
	beforeEach(() => {
		getDashboardStatistics.mockResolvedValue({
			...getDefaultDashboardData(),
			areaCount: 4,
			totalCoverageKm2: 12.5,
			areasByType: [{ type_name: 'Ausbau', count: 3 }],
			areaTotalAddresses: 10,
			addressesInAreas: 5,
			totalNodes: 8,
			nodesInAreas: 2,
			totalResidentialUnits: 20,
			residentialUnitsInAreas: 15,
			addressesPerArea: [{ name: 'Süd', count: 5 }],
			addressesByAreaType: [{ type: 'Ausbau', count: 5 }],
			nodesPerArea: [{ name: 'Süd', count: 2 }],
			nodesByAreaType: [{ type: 'Ausbau', count: 2 }],
			trenchLengthPerArea: [{ name: 'Süd', length_m: 1500 }],
			residentialByAreaType: [{ type: 'Ausbau', count: 10 }]
		});
	});

	test('should render the coverage tiles and chart panels', async () => {
		renderTab();

		expect(await screen.findByText('form_area_total_count')).toBeInTheDocument();
		expect(getDashboardStatistics).toHaveBeenCalledWith({ projectId: '7' });
		expect(screen.getByText('form_area_total_coverage')).toBeInTheDocument();
		expect(screen.getByText('form_area_address_coverage')).toBeInTheDocument();
		expect(screen.getByText('form_area_node_coverage')).toBeInTheDocument();
		expect(screen.getByText('form_area_by_type')).toBeInTheDocument();
		expect(screen.getByText('form_area_addresses_per_area')).toBeInTheDocument();
	});

	test('should show the total area count and coverage', async () => {
		renderTab();

		expect(await screen.findByText('4')).toBeInTheDocument();
		expect(screen.getByText('12,50 km²')).toBeInTheDocument();
	});

	test('should show how many features lie inside areas', async () => {
		renderTab();

		expect(await screen.findByText('5 / 10')).toBeInTheDocument();
		expect(screen.getByText('(50%)')).toBeInTheDocument();
		expect(screen.getByText('2 / 8')).toBeInTheDocument();
		expect(screen.getByText('(25%)')).toBeInTheDocument();
		expect(screen.getByText('15 / 20')).toBeInTheDocument();
		expect(screen.getByText('(75%)')).toBeInTheDocument();
	});

	test('should report 0% coverage when the project has no features', async () => {
		getDashboardStatistics.mockResolvedValue(getDefaultDashboardData());
		renderTab();

		expect(await screen.findAllByText('(0%)')).toHaveLength(3);
	});
});
