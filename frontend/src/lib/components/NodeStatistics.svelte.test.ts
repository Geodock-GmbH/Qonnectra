import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import NodeStatistics from './NodeStatistics.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('NodeStatistics', () => {
	test('should render all six node charts', () => {
		render(NodeStatistics, {
			nodesByCity: [{ city: 'Preetz', count: 3 }],
			nodesByStatus: [{ status: 'aktiv', count: 2 }],
			nodesByNetworkLevel: [{ network_level: 'NE3', count: 1 }],
			nodesByType: [{ node_type: 'POP', count: 1 }],
			nodesByOwner: [{ owner: null, count: 4 }],
			newestNodes: [{ name: 'PoP-1', node_type: 'POP' }]
		});

		expect(screen.getByText('form_nodes_by_city')).toBeInTheDocument();
		expect(screen.getByText('form_nodes_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_nodes_by_network_level')).toBeInTheDocument();
		expect(screen.getByText('form_nodes_by_type')).toBeInTheDocument();
		expect(screen.getByText('form_nodes_by_owner')).toBeInTheDocument();
		expect(screen.getByText('form_newest_nodes')).toBeInTheDocument();
	});

	test('should render placeholders when the statistics are empty', () => {
		render(NodeStatistics, {
			nodesByCity: [],
			nodesByStatus: [],
			nodesByNetworkLevel: [],
			nodesByType: [],
			nodesByOwner: [],
			newestNodes: []
		});

		expect(screen.getAllByText('form_no_data_available')).toHaveLength(6);
	});
});
