import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import MapDrawerTabs from './MapDrawerTabs.svelte';

const getFeatureDetails = vi.fn();

vi.mock('$lib/remote/map/feature-search.remote', () => ({
	getFeatureDetails: (...args: unknown[]) => getFeatureDetails(...args)
}));

vi.mock('$lib/remote/map/trenches.remote', () => ({
	getConduitsInTrench: vi.fn().mockResolvedValue([])
}));

vi.mock('$app/state', async () => {
	const { pageStub } = await import('$lib/test-utils/pageStub');
	return {
		page: pageStub({
			routeId: '/project/[projectId=integer]/map',
			params: { projectId: '7' },
			url: 'http://localhost/project/7/map?feature=address:addr-1&tab=actions'
		})
	};
});

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => prop })
}));

afterEach(() => {
	getFeatureDetails.mockReset();
});

describe('MapDrawerTabs actions', () => {
	test('links an address to its detail page in the project it belongs to', async () => {
		getFeatureDetails.mockResolvedValue({
			id: 'addr-1',
			type: 'Feature',
			geometry: null,
			properties: { id_address: 'A-1', street: 'Hauptstraße', housenumber: 3, project: { id: 3 } }
		});

		render(BoundaryFixture, {
			props: { component: MapDrawerTabs, props: { kind: 'address', uuid: 'addr-1' } }
		});

		const link = await screen.findByRole('link', { name: 'action_view_address' });
		expect(link).toHaveAttribute('href', '/project/3/address/addr-1');
	});

	test('links a node to the detail page of its linked address', async () => {
		getFeatureDetails.mockResolvedValue({
			id: 'node-1',
			type: 'Feature',
			geometry: null,
			properties: {
				name: 'PoP-1',
				project: { id: 3 },
				uuid_address: {
					id: 'addr-9',
					type: 'Feature',
					geometry: null,
					properties: { street: 'Hauptstraße', housenumber: 12, project: { id: 5 } }
				}
			}
		});

		render(BoundaryFixture, {
			props: { component: MapDrawerTabs, props: { kind: 'node', uuid: 'node-1' } }
		});

		const link = await screen.findByRole('link', { name: 'action_view_address' });
		expect(link).toHaveAttribute('href', '/project/5/address/addr-9');
	});

	test('offers no address link for a node without a linked address', async () => {
		getFeatureDetails.mockResolvedValue({
			id: 'node-1',
			type: 'Feature',
			geometry: null,
			properties: { name: 'PoP-1', project: { id: 3 }, uuid_address: null }
		});

		render(BoundaryFixture, {
			props: { component: MapDrawerTabs, props: { kind: 'node', uuid: 'node-1' } }
		});

		await screen.findByRole('button', { name: 'action_trace' });
		expect(screen.queryByRole('link', { name: 'action_view_address' })).not.toBeInTheDocument();
	});
});
