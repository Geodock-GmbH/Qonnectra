import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';
import { globalToaster } from '$lib/stores/toaster';

import ConduitAttributeCard from './ConduitAttributeCard.svelte';

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

const conduit = {
	uuid: 'conduit-1',
	name: 'Rohr-A',
	outer_conduit: 'AR-12',
	conduit_type: { id: 4 },
	status: { id: 2 },
	network_level: { id: 3 },
	owner: { id: 5 },
	manufacturer: { id: 6 },
	date: '2024-01-01',
	flag: { id: 7 }
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
	drawerStore.open({ props: conduit });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	drawerStore.close();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('ConduitAttributeCard', () => {
	test('should prefill the form from the drawer conduit', () => {
		mockRoutes();

		render(ConduitAttributeCard, {});

		expect(screen.getByDisplayValue('Rohr-A')).toBeInTheDocument();
		expect(screen.getByDisplayValue('AR-12')).toBeInTheDocument();
		expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
	});

	test('should submit the conduit update to ?/updateConduit with attribute ids', async () => {
		mockRoutes({ '?/updateConduit': { type: 'success', data: { conduit } } });
		const onConduitUpdate = vi.fn();

		render(ConduitAttributeCard, {
			onConduitUpdate
		} as unknown as Parameters<typeof render<typeof ConduitAttributeCard>>[1]);
		fetchMock.mockClear();

		const form = document.getElementById('conduit-form') as HTMLFormElement;
		form.requestSubmit();
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());

		const call = fetchMock.mock.calls.find(([url]) => url === '?/updateConduit');
		expect(call).toBeTruthy();
		const body = call![1].body as FormData;
		expect(body.get('uuid')).toBe('conduit-1');
		expect(body.get('conduit_name')).toBe('Rohr-A');
		expect(body.get('outer_conduit')).toBe('AR-12');
		expect(body.get('conduit_type_id')).toBe('4');
		expect(body.get('status_id')).toBe('2');
		expect(body.get('network_level_id')).toBe('3');
		expect(body.get('owner_id')).toBe('5');
		expect(body.get('manufacturer_id')).toBe('6');
		expect(body.get('flag_id')).toBe('7');
		expect(onConduitUpdate).toHaveBeenCalledWith(conduit);
	});

	test('should toast an error when the update fails', async () => {
		mockRoutes({ '?/updateConduit': { type: 'failure', data: { error: 'nein' } } });
		const onConduitUpdate = vi.fn();

		render(ConduitAttributeCard, {
			onConduitUpdate
		} as unknown as Parameters<typeof render<typeof ConduitAttributeCard>>[1]);

		const form = document.getElementById('conduit-form') as HTMLFormElement;
		form.requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(globalToaster.success).not.toHaveBeenCalled();
		expect(onConduitUpdate).not.toHaveBeenCalled();
	});

	test('should delete the conduit and notify the parent on confirm', async () => {
		mockRoutes({ '?/deleteConduit': { type: 'success' } });
		const onConduitDelete = vi.fn();

		render(ConduitAttributeCard, {
			onConduitDelete
		} as unknown as Parameters<typeof render<typeof ConduitAttributeCard>>[1]);

		// confirmDelete opens MessageBox; invoke the delete action directly via its accept flow.
		const deleteButton = screen.getByText('action_delete_conduit');
		deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// The confirm dialog's accept button carries the delete label.
		await vi.waitFor(() => {
			const accept = screen.getByText('common_delete');
			expect(accept).toBeInTheDocument();
		});
		screen.getByText('common_delete').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/deleteConduit');
			expect(call).toBeTruthy();
			const body = call![1].body as FormData;
			expect(body.get('uuid')).toBe('conduit-1');
		});
		await vi.waitFor(() => expect(onConduitDelete).toHaveBeenCalledWith('conduit-1'));
	});
});
