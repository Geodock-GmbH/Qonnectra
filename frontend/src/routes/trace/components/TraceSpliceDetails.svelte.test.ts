import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import TraceSpliceDetails from './TraceSpliceDetails.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('TraceSpliceDetails', () => {
	test('should render the port and every component placement chip', () => {
		render(TraceSpliceDetails, {
			splice: {
				port_number: 7,
				component: {
					type: 'Spleißkassette',
					slot_start: 3,
					slot_end: 4,
					slot_side: 'A',
					in_or_out: 'IN'
				}
			}
		});

		expect(screen.getByText('form_port 7')).toBeInTheDocument();
		expect(screen.getByText('Spleißkassette')).toBeInTheDocument();
		expect(screen.getByText(/3-4/)).toBeInTheDocument();
		expect(screen.getByText('form_side: A')).toBeInTheDocument();
		expect(screen.getByText('IN')).toBeInTheDocument();
	});

	test('should render the container path in order', () => {
		render(TraceSpliceDetails, {
			splice: {
				port_number: 1,
				container_path: [{ type: 'Schrank', name: 'S1' }, { type: 'Muffe' }]
			}
		});

		expect(screen.getByText(/trace_container_path/)).toBeInTheDocument();
		expect(screen.getByText('Schrank: S1')).toBeInTheDocument();
		expect(screen.getByText('Muffe')).toBeInTheDocument();
		expect(screen.getByText('→')).toBeInTheDocument();
	});

	test('should omit the container path when it is empty', () => {
		render(TraceSpliceDetails, { splice: { port_number: 1, container_path: [] } });

		expect(screen.queryByText(/trace_container_path/)).not.toBeInTheDocument();
	});
});
