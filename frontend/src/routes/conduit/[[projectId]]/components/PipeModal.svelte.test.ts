import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import PipeModal from './PipeModal.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

const createConduit = vi.fn();
const getConduitList = vi.fn();

vi.mock('$lib/remote/conduit/conduits.remote', () => ({
	createConduit: (...args: unknown[]) => createConduit(...args),
	getConduitList: (...args: unknown[]) => getConduitList(...args)
}));

vi.mock('$lib/remote/conduit/attribute-options.remote', () => ({
	getConduitTypeOptions: vi.fn().mockResolvedValue([{ value: 1, label: 'DA 50' }]),
	getStatusOptions: vi.fn().mockResolvedValue([{ value: 2, label: 'geplant' }]),
	getNetworkLevelOptions: vi.fn().mockResolvedValue([{ value: 3, label: 'NE3' }]),
	getCompanyOptions: vi.fn().mockResolvedValue([{ value: 4, label: 'Firma' }]),
	getFlagOptions: vi.fn().mockResolvedValue([{ value: 5, label: 'Bau' }])
}));

vi.mock('$lib/components/GenericCombobox.svelte', async () => {
	const { default: MockGenericCombobox } =
		await import('$lib/test-utils/mocks/MockGenericCombobox.svelte');
	return { default: MockGenericCombobox };
});

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

const STORAGE_KEY = 'conduit-form-defaults';

function renderModal(props: Record<string, unknown> = {}) {
	return render(BoundaryFixture, {
		props: { component: PipeModal, props: { projectId: '7', openPipeModal: true, ...props } }
	});
}

function pipeForm() {
	return document.getElementById('pipe-form') as HTMLFormElement;
}

function nameInput() {
	return document.getElementById('pipe-name') as HTMLInputElement;
}

function dialogState() {
	return document.querySelector('[data-part="content"]')?.getAttribute('data-state');
}

beforeEach(() => {
	localStorage.clear();
	createConduit.mockReturnValue(commandResult({ uuid: 'new-1', name: 'Neues-Rohr' }));
});

afterEach(() => {
	createConduit.mockReset();
	getConduitList.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('PipeModal', () => {
	test('should render the create-conduit form with the loaded option lists', async () => {
		renderModal();

		expect(await screen.findByRole('option', { name: 'DA 50' })).toBeInTheDocument();
		expect(dialogState()).toBe('open');
		expect(pipeForm()).toBeInTheDocument();
		expect(nameInput()).toBeInTheDocument();
		expect(document.getElementById('outer_conduit')).toBeInTheDocument();
		expect(document.getElementById('date')).toBeInTheDocument();
	});

	test('should keep the dialog closed when openPipeModal is false', async () => {
		renderModal({ openPipeModal: false });

		await screen.findByTestId('add-conduit-button');
		expect(dialogState()).toBe('closed');
	});

	test('should prefill the form from the saved defaults when opened', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ conduitName: 'Gespeichert', outerConduit: 'AR-1', date: '2024-02-02' })
		);
		renderModal();

		expect(await screen.findByDisplayValue('Gespeichert')).toBeInTheDocument();
		expect(screen.getByDisplayValue('AR-1')).toBeInTheDocument();
		expect(screen.getByDisplayValue('2024-02-02')).toBeInTheDocument();
	});

	test('should create the conduit through the command, refresh the list and save the defaults', async () => {
		const user = userEvent.setup();
		renderModal();
		await screen.findByRole('option', { name: 'DA 50' });

		await user.type(nameInput(), 'Neues-Rohr');
		await user.type(document.getElementById('outer_conduit') as HTMLTextAreaElement, 'AR-99');
		await user.type(document.getElementById('date') as HTMLInputElement, '2024-05-05');
		pipeForm().requestSubmit();

		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
		expect(createConduit).toHaveBeenCalledWith({
			projectId: 7,
			name: 'Neues-Rohr',
			outer_conduit: 'AR-99',
			date: '2024-05-05',
			conduit_type_id: undefined,
			status_id: undefined,
			network_level_id: undefined,
			owner_id: undefined,
			constructor_id: undefined,
			manufacturer_id: undefined,
			flag_id: undefined
		});
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		expect(stored.conduitName).toBe('Neues-Rohr');
		expect(stored.outerConduit).toBe('AR-99');
		// The dialog stays open with its values for the next entry.
		expect(dialogState()).toBe('open');
		expect(nameInput().value).toBe('Neues-Rohr');
	});

	test('should toast the duplicate message on a 409', async () => {
		const user = userEvent.setup();
		createConduit.mockReturnValue(commandFailure(httpError(409, 'name: exists')));
		renderModal();
		await screen.findByRole('option', { name: 'DA 50' });

		await user.type(nameInput(), 'Dup-Rohr');
		pipeForm().requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(vi.mocked(globalToaster.error).mock.calls[0][0].description).toBe(
			'message_error_duplicate_conduit'
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	test('should toast the backend message on another rejection', async () => {
		const user = userEvent.setup();
		createConduit.mockReturnValue(commandFailure(httpError(400, 'flag_id: required')));
		renderModal();
		await screen.findByRole('option', { name: 'DA 50' });

		await user.type(nameInput(), 'Rohr');
		pipeForm().requestSubmit();

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
		expect(vi.mocked(globalToaster.error).mock.calls[0][0].description).toBe('flag_id: required');
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should close the dialog and clear the name field when the close button is clicked', async () => {
		const user = userEvent.setup();
		renderModal();
		await screen.findByRole('option', { name: 'DA 50' });

		await user.type(nameInput(), 'Rohr-zu-schliessen');
		expect(nameInput().value).toBe('Rohr-zu-schliessen');

		await user.click(screen.getByText('action_close'));

		await vi.waitFor(() => expect(dialogState()).toBe('closed'));
		expect(nameInput().value).toBe('');
	});
});
