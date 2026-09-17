import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import FiberConnectionsCard from './FiberConnectionsCard.svelte';

const getUnitFiberConnections = vi.fn();

vi.mock('$lib/remote/address/residential-units.remote', () => ({
	getUnitFiberConnections: (...args: unknown[]) => getUnitFiberConnections(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const connection = {
	parent_node_name: 'Parent',
	node_name: 'Node A',
	cable_name: 'K-Nord',
	fiber_number_absolute: 12,
	bundle_number: 1,
	bundle_color: 'red',
	bundle_color_hex: '#ff0000',
	fiber_number: 12,
	fiber_color: 'blue',
	fiber_color_hex: '#0000ff'
};

function renderCard(connections: unknown[]) {
	getUnitFiberConnections.mockResolvedValue(connections);
	return render(BoundaryFixture, {
		props: { component: FiberConnectionsCard, props: { unitUuid: 'ru-1' } }
	});
}

afterEach(() => {
	getUnitFiberConnections.mockReset();
});

describe('FiberConnectionsCard', () => {
	test('should query the connections and render them with a count badge', async () => {
		renderCard([connection, { ...connection, cable_name: 'K-Süd' }]);

		expect(await screen.findAllByText('K-Nord')).not.toHaveLength(0);
		expect(screen.getAllByText('K-Süd')).not.toHaveLength(0);
		expect(screen.getByText('2')).toHaveClass('badge');
		expect(getUnitFiberConnections).toHaveBeenCalledWith('ru-1');
	});

	test('should render the empty state when the unit has no connections', async () => {
		renderCard([]);

		expect(await screen.findByText('message_no_fiber_connections')).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});
});
