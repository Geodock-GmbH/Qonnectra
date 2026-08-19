import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import ConduitStatistics from './ConduitStatistics.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('ConduitStatistics', () => {
	test('should render every conduit chart panel with empty defaults', () => {
		render(ConduitStatistics);

		expect(screen.getByText('form_length_by_conduit_type')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_status_and_type')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_network_level')).toBeInTheDocument();
		expect(screen.getByText('form_avg_length_by_type')).toBeInTheDocument();
		expect(screen.getByText('form_conduit_count_by_status')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_owner')).toBeInTheDocument();
		expect(screen.getByText('form_length_by_manufacturer')).toBeInTheDocument();
		expect(screen.getByText('form_conduits_over_time')).toBeInTheDocument();
	});

	test('should render charts when data is provided', () => {
		const { container } = render(ConduitStatistics, {
			lengthByType: [{ conduit_type: 'DA 50', gesamt_länge: 1500 }],
			countByStatus: [{ status: 'verlegt', count: 3 }]
		});

		expect(container.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(1);
	});
});
