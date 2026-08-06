import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';
import { globalToaster } from '$lib/stores/toaster';

import CableDiagramEdgeAttributeCard from './CableDiagramEdgeAttributeCard.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

const fetchMock = vi.fn();

const cable = {
	uuid: 'cable-1',
	name: 'K-Nord',
	length: 120,
	length_total: 140,
	cable_type: { id: 1, cable_type: 'LWL 96', fiber_count: 96 },
	status: { id: 2 },
	network_level: { id: 3 }
};

function mockRoutes(routes: Record<string, unknown> = {}) {
	fetchMock.mockImplementation((url: string) => {
		const payload = routes[url] ?? { type: 'success', data: {} };
		return Promise.resolve({
			ok: true,
			text: () => Promise.resolve(JSON.stringify(payload)),
			json: () => Promise.resolve(payload)
		});
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
	drawerStore.open({ props: cable });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	drawerStore.close();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('CableDiagramEdgeAttributeCard', () => {
	test('should prefill the form from the drawer cable and load connected conduits', async () => {
		mockRoutes({
			'?/getConduitsForCable': { type: 'success', data: { conduit_names: ['DA 50', 'DA 32'] } }
		});

		render(CableDiagramEdgeAttributeCard, {});

		expect(screen.getByDisplayValue('K-Nord')).toBeInTheDocument();
		await vi.waitFor(() => expect(screen.getByDisplayValue('DA 50, DA 32')).toBeInTheDocument());
		expect(screen.getByDisplayValue('120')).toBeInTheDocument();
		expect(screen.getByDisplayValue('140')).toBeInTheDocument();
	});

	test('should submit the cable update with attribute ids and toast success', async () => {
		mockRoutes();
		const user = userEvent.setup();
		const onLabelUpdate = vi.fn();
		const onSaveComplete = vi.fn();

		render(CableDiagramEdgeAttributeCard, {
			onEdgeDelete: vi.fn(),
			onLabelUpdate,
			onSaveComplete
		});
		fetchMock.mockClear();

		const form = document.getElementById('cable-form') as HTMLFormElement;
		form.requestSubmit();
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());

		const updateCall = fetchMock.mock.calls.find(([url]) => url === '?/updateCable');
		const body = updateCall![1].body as FormData;
		expect(body.get('uuid')).toBe('cable-1');
		expect(body.get('cable_type_id')).toBe('1');
		expect(body.get('status_id')).toBe('2');
		expect(body.get('network_level_id')).toBe('3');
		expect(onLabelUpdate).toHaveBeenCalledWith('K-Nord');
		expect(onSaveComplete).toHaveBeenCalled();
	});

	test('should toast an error when the update fails', async () => {
		mockRoutes({ '?/updateCable': { type: 'failure', data: { error: 'nein' } } });

		render(CableDiagramEdgeAttributeCard, {});

		const form = document.getElementById('cable-form') as HTMLFormElement;
		form.requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(globalToaster.success).not.toHaveBeenCalled();
	});
});
