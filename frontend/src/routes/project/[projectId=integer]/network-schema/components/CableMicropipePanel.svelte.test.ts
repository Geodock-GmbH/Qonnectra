import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi } from 'vitest';

import CableMicropipePanel from './CableMicropipePanel.svelte';

vi.mock('$app/state', () => ({
	page: { params: { projectId: '7' } }
}));

vi.mock('ol/ol.css', () => ({}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('$lib/stores/store', async () => {
	const { writable } = await import('svelte/store');
	return { showCableRoute: writable(false) };
});

vi.mock('$lib/components/Map.svelte', async () => {
	const { default: MockMap } = await import('$lib/test-utils/mocks/MockMap.svelte');
	return { default: MockMap };
});

vi.mock('$lib/classes/MapState.svelte', () => ({
	MapState: class {
		vectorTileLayer = null;
		initializeLayers = () => true;
		getLayers = () => [];
		cleanup = () => {};
	}
}));

vi.mock('$lib/map/layerStyleSync', () => ({
	syncLayerStyles: () => () => {}
}));

vi.mock('$lib/remote/network-schema/micropipes.remote', () => ({
	getLinkedTrenchesForCable: () => ({ refresh: async () => {}, current: [] }),
	getConduitsByTrenches: vi.fn(),
	getMicropipesByConduits: vi.fn(),
	createMicropipeConnections: vi.fn(),
	deleteMicropipeConnections: vi.fn()
}));

describe('CableMicropipePanel', () => {
	test('should hand the route project to the map, so it opens on the remembered view and can zoom to layer extents', async () => {
		render(CableMicropipePanel, { props: { cableId: 'cable-1', cableName: 'Kollo-Grw-05-01-01' } });

		expect(await screen.findByTestId('map')).toHaveAttribute('data-project-id', '7');
	});
});
