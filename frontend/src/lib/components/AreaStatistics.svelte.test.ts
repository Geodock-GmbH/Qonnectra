import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import AreaStatistics from './AreaStatistics.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const props = {
	areaCount: 4,
	totalCoverageKm2: 12.5,
	areasByType: [{ type_name: 'Ausbau', count: 3 }],
	totalAddresses: 10,
	addressesInAreas: 5,
	totalNodes: 8,
	nodesInAreas: 2,
	totalResidentialUnits: 20,
	residentialUnitsInAreas: 10,
	addressesPerArea: [{ name: 'Süd', count: 5 }],
	addressesByAreaType: [{ type: 'Ausbau', count: 5 }],
	nodesPerArea: [{ name: 'Süd', count: 2 }],
	nodesByAreaType: [{ type: 'Ausbau', count: 2 }],
	trenchLengthPerArea: [{ name: 'Süd', length: 1500 }],
	residentialByAreaType: [{ type: 'Ausbau', count: 10 }]
};

describe('AreaStatistics', () => {
	test('should render the coverage tiles and chart panels', () => {
		render(AreaStatistics, props);

		expect(screen.getByText('form_area_total_count')).toBeInTheDocument();
		expect(screen.getByText('form_area_total_coverage')).toBeInTheDocument();
		expect(screen.getByText('form_area_address_coverage')).toBeInTheDocument();
		expect(screen.getByText('form_area_node_coverage')).toBeInTheDocument();
		expect(screen.getByText('form_area_by_type')).toBeInTheDocument();
		expect(screen.getByText('form_area_addresses_per_area')).toBeInTheDocument();
	});

	test('should show the total area count', () => {
		render(AreaStatistics, props);

		expect(screen.getByText('4')).toBeInTheDocument();
	});
});
