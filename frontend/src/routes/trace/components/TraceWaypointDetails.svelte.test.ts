import type { FiberWaypoint } from '$lib/types/trace';
import { createRawSnippet } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import TraceWaypointDetails from './TraceWaypointDetails.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const details = createRawSnippet(() => ({
	render: () => '<p>Extra-Karte</p>'
}));

const endpoints = {
	cable_name: 'K-Nord',
	start_node: { id: 'n1', name: 'PoP-Nord' },
	end_node: { id: 'n2', name: 'NVt-7' }
};

/**
 * @param overrides - Fields replacing the bare waypoint's.
 * @returns A waypoint on fiber F1 with only the given extras.
 */
function waypoint(overrides: Partial<FiberWaypoint> = {}): FiberWaypoint {
	return { fiber: { id: 'f1', layer: 'inner' }, ...overrides } as FiberWaypoint;
}

describe('TraceWaypointDetails', () => {
	test('should show the cable ends and expand the fiber, splice and extra details on demand', async () => {
		const user = userEvent.setup();
		render(TraceWaypointDetails, {
			node: waypoint({ cable_endpoints: endpoints, splice: { port_number: 4 } }),
			details
		});

		expect(screen.getByText(/PoP-Nord/)).toHaveTextContent('PoP-Nord ↔ NVt-7');
		expect(screen.queryByText('Extra-Karte')).not.toBeInTheDocument();

		const toggle = screen.getByRole('button', { name: /trace_details/ });
		await user.click(toggle);

		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('form_port 4')).toBeInTheDocument();
		expect(screen.getByText(/inner/)).toBeInTheDocument();
		expect(screen.getByText('Extra-Karte')).toBeInTheDocument();
	});

	test('should offer no details toggle when the waypoint has nothing beyond its fiber', () => {
		render(TraceWaypointDetails, { node: waypoint(), details });

		expect(screen.queryByRole('button', { name: /trace_details/ })).not.toBeInTheDocument();
	});
});
