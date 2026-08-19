import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import TrenchStatistics from './TrenchStatistics.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('TrenchStatistics', () => {
	test('should render the trench chart panels', () => {
		render(TrenchStatistics, {
			lengthByTypes: [
				{ oberfläche: 'Asphalt', bauweise: 'offen', gesamt_länge: 1500 },
				{ oberfläche: 'Asphalt', bauweise: 'geschlossen', gesamt_länge: 500 },
				{ oberfläche: 'Grünfläche', bauweise: 'offen', gesamt_länge: 1000 }
			],
			avgHouseConnectionLength: [{ avg_length: 12 }],
			lengthWithFunding: [{ funded: true, gesamt_länge: 2000 }],
			lengthWithInternalExecution: [{ internal: true, gesamt_länge: 800 }],
			lengthByStatus: [{ status: 'fertig', gesamt_länge: 3000 }],
			lengthByNetworkLevel: [{ network_level: 'NE3', gesamt_länge: 3000 }],
			longestRoutes: [{ id_trench: 'T-1', länge: 900 }]
		});

		expect(screen.getByText('form_length_by_surface')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_construction_type')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_network_level')).toBeInTheDocument();
	});

	test('should render placeholders for empty data', () => {
		render(TrenchStatistics, {
			lengthByTypes: [],
			avgHouseConnectionLength: [],
			lengthWithFunding: [],
			lengthWithInternalExecution: [],
			lengthByStatus: [],
			lengthByNetworkLevel: [],
			longestRoutes: []
		});

		expect(screen.getAllByText('form_no_data_available').length).toBeGreaterThan(0);
	});
});
