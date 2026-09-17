import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import MicroductConnectionsCard from './MicroductConnectionsCard.svelte';

const getAddressLinks = vi.fn();

vi.mock('$lib/remote/address/addresses.remote', () => ({
	getAddressLinks: (...args: unknown[]) => getAddressLinks(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const microduct = {
	uuid: 'md-1',
	number: 7,
	color: 'blue',
	colorHex: '#0000ff',
	conduitName: 'DA 50',
	conduitType: 'Speedpipe',
	nodeName: 'Node A',
	nodeUuid: 'n-1',
	parentNodeName: 'Parent'
};

function renderCard(microducts: unknown[]) {
	getAddressLinks.mockResolvedValue({ nodes: [], microducts });
	return render(BoundaryFixture, {
		props: { component: MicroductConnectionsCard, props: { uuid: 'addr-1' } }
	});
}

afterEach(() => {
	getAddressLinks.mockReset();
});

describe('MicroductConnectionsCard', () => {
	test('should query the links and render a row per microduct with its count', async () => {
		renderCard([microduct, { ...microduct, uuid: 'md-2', number: 8, nodeName: 'Node B' }]);

		expect(await screen.findAllByText('Node A')).not.toHaveLength(0);
		expect(screen.getAllByText('Node B')).not.toHaveLength(0);
		expect(screen.getAllByText('DA 50')).not.toHaveLength(0);
		expect(screen.getByText('2')).toHaveClass('badge');
		expect(getAddressLinks).toHaveBeenCalledWith('addr-1');
	});

	test('should render the empty state when no microducts are linked', async () => {
		renderCard([]);

		expect(await screen.findByText('message_no_microducts_linked')).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});
});
