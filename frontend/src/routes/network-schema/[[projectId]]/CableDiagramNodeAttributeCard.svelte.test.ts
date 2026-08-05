import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';
import { globalToaster } from '$lib/stores/toaster';

import CableDiagramNodeAttributeCard from './CableDiagramNodeAttributeCard.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

const pageStore = vi.hoisted(() => {
	const value = { url: new URL('http://localhost/network-schema/7'), data: {}, params: {} };
	return {
		subscribe(run: (value: unknown) => void) {
			run(value);
			return () => {};
		}
	};
});

vi.mock('$app/stores', () => ({
	page: pageStore
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

const node = {
	id: 'node-1',
	name: 'PoP-1',
	node_type: { id: 4 },
	status: { id: 2 },
	warranty: '2030',
	parent_node: { uuid: 'parent-1' }
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
	drawerStore.open({ props: node });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	drawerStore.close();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('CableDiagramNodeAttributeCard', () => {
	test('should prefill the form from the drawer node', () => {
		mockRoutes();

		render(CableDiagramNodeAttributeCard, {});

		expect(screen.getByDisplayValue('PoP-1')).toBeInTheDocument();
	});

	test('should submit the node update with attribute and parent ids', async () => {
		mockRoutes();
		const onLabelUpdate = vi.fn();

		render(CableDiagramNodeAttributeCard, { onLabelUpdate });
		fetchMock.mockClear();

		const form = document.getElementById('node-form') as HTMLFormElement;
		form.requestSubmit();
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());

		const updateCall = fetchMock.mock.calls.find(([url]) => url === '?/updateNode');
		const body = updateCall![1].body as FormData;
		expect(body.get('uuid')).toBe('node-1');
		expect(body.get('node_type_id')).toBe('4');
		expect(body.get('status_id')).toBe('2');
		expect(body.get('parent_node_id')).toBe('parent-1');
		expect(onLabelUpdate).toHaveBeenCalledWith('PoP-1');
	});

	test('should toast an error when the update fails', async () => {
		mockRoutes({ '?/updateNode': { type: 'failure', data: { error: 'nein' } } });

		render(CableDiagramNodeAttributeCard, {});

		const form = document.getElementById('node-form') as HTMLFormElement;
		form.requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(globalToaster.success).not.toHaveBeenCalled();
	});
});
