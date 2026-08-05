import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import PipeModal from './PipeModal.svelte';

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
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

function pipeForm() {
	return document.getElementById('pipe-form') as HTMLFormElement;
}

function dialogState() {
	return document.querySelector('[data-part="content"]')?.getAttribute('data-state');
}

describe('PipeModal', () => {
	test('should render the create-conduit form fields when open', () => {
		mockRoutes();
		render(PipeModal, { projectId: 'proj-1', openPipeModal: true });

		expect(dialogState()).toBe('open');
		expect(pipeForm()).toBeInTheDocument();
		expect(document.getElementById('pipe-name')).toBeInTheDocument();
		expect(document.getElementById('outer_conduit')).toBeInTheDocument();
		expect(document.getElementById('date')).toBeInTheDocument();
	});

	test('should keep the dialog closed when openPipeModal is false', () => {
		mockRoutes();
		render(PipeModal, { projectId: 'proj-1', openPipeModal: false });

		expect(dialogState()).toBe('closed');
	});

	test('should submit ?/createConduit with the entered name, date, project and outer conduit', async () => {
		const user = userEvent.setup();
		const created = { uuid: 'new-1', name: 'Neues-Rohr' };
		mockRoutes({ '?/createConduit': { type: 'success', data: { conduit: created } } });
		const onPipeCreate = vi.fn();

		render(PipeModal, { projectId: 'proj-1', openPipeModal: true, onPipeCreate });

		const nameInput = document.getElementById('pipe-name') as HTMLInputElement;
		await user.type(nameInput, 'Neues-Rohr');
		const outer = document.getElementById('outer_conduit') as HTMLTextAreaElement;
		await user.type(outer, 'AR-99');
		const date = document.getElementById('date') as HTMLInputElement;
		await user.type(date, '2024-05-05');

		fetchMock.mockClear();
		pipeForm().requestSubmit();

		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());

		const call = fetchMock.mock.calls.find(([url]) => url === '?/createConduit');
		expect(call).toBeTruthy();
		const body = call![1].body as FormData;
		expect(body.get('name')).toBe('Neues-Rohr');
		expect(body.get('project_id')).toBe('proj-1');
		expect(body.get('outer_conduit')).toBe('AR-99');
		expect(body.get('date')).toBe('2024-05-05');
		expect(onPipeCreate).toHaveBeenCalledWith(created);
	});

	test('should toast a duplicate error on a duplicate failure', async () => {
		const user = userEvent.setup();
		mockRoutes({ '?/createConduit': { type: 'failure', data: { isDuplicate: true } } });
		const onPipeCreate = vi.fn();

		render(PipeModal, { projectId: 'proj-1', openPipeModal: true, onPipeCreate });

		await user.type(document.getElementById('pipe-name') as HTMLInputElement, 'Dup-Rohr');
		pipeForm().requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(vi.mocked(globalToaster.error).mock.calls[0][0].description).toBe(
			'message_error_duplicate_conduit'
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
		expect(onPipeCreate).not.toHaveBeenCalled();
	});

	test('should toast a generic create error on a plain failure', async () => {
		const user = userEvent.setup();
		mockRoutes({ '?/createConduit': { type: 'failure', data: {} } });

		render(PipeModal, { projectId: 'proj-1', openPipeModal: true });

		await user.type(document.getElementById('pipe-name') as HTMLInputElement, 'Rohr');
		pipeForm().requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(vi.mocked(globalToaster.error).mock.calls[0][0].description).toBe(
			'message_error_creating_conduit'
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should close the dialog and clear the name field when the close button is clicked', async () => {
		const user = userEvent.setup();
		mockRoutes();

		render(PipeModal, { projectId: 'proj-1', openPipeModal: true });

		const nameInput = document.getElementById('pipe-name') as HTMLInputElement;
		await user.type(nameInput, 'Rohr-zu-schliessen');
		expect(nameInput.value).toBe('Rohr-zu-schliessen');

		await user.click(screen.getByText('action_close'));

		// handleClose sets openPipeModal=false and clears parameters.
		await vi.waitFor(() => expect(dialogState()).toBe('closed'));
		expect((document.getElementById('pipe-name') as HTMLInputElement).value).toBe('');
	});
});
