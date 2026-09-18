import type { ConduitRecord } from '$lib/remote/conduit/conduit-data';
import { get } from 'svelte/store';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';
import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import ConduitAttributeCard from './ConduitAttributeCard.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

const getConduit = vi.fn();
const getConduitList = vi.fn();
const updateConduit = vi.fn();
const deleteConduit = vi.fn();

vi.mock('$lib/remote/conduit/conduits.remote', () => ({
	getConduit: (...args: unknown[]) => getConduit(...args),
	getConduitList: (...args: unknown[]) => getConduitList(...args),
	updateConduit: (...args: unknown[]) => updateConduit(...args),
	deleteConduit: (...args: unknown[]) => deleteConduit(...args)
}));

vi.mock('$lib/remote/conduit/attribute-options.remote', () => ({
	getConduitTypeOptions: vi.fn().mockResolvedValue([{ value: 4, label: 'DA 50' }]),
	getStatusOptions: vi.fn().mockResolvedValue([{ value: 2, label: 'geplant' }]),
	getNetworkLevelOptions: vi.fn().mockResolvedValue([{ value: 3, label: 'NE3' }]),
	getCompanyOptions: vi.fn().mockResolvedValue([{ value: 5, label: 'Firma' }]),
	getFlagOptions: vi.fn().mockResolvedValue([{ value: 7, label: 'Bau' }])
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

const conduit: ConduitRecord = {
	uuid: 'conduit-1',
	name: 'Rohr-A',
	outer_conduit: 'AR-12',
	conduit_type: { id: 4, conduit_type: 'DA 50' },
	status: { id: 2, status: 'geplant' },
	network_level: { id: 3, network_level: 'NE3' },
	owner: { id: 5, company: 'Firma' },
	constructor: null,
	manufacturer: { id: 6, company: 'Hersteller' },
	date: '2024-01-01',
	flag: { id: 7, flag: 'Bau' }
};

function renderCard() {
	return render(BoundaryFixture, {
		props: { component: ConduitAttributeCard, props: { uuid: 'conduit-1' } }
	});
}

function conduitForm() {
	return document.getElementById('conduit-form') as HTMLFormElement;
}

beforeEach(() => {
	getConduit.mockResolvedValue(conduit);
	updateConduit.mockReturnValue(commandResult({ ...conduit, name: 'Rohr-Neu' }));
	deleteConduit.mockReturnValue(commandResult(undefined));
	drawerStore.open({ title: 'Rohr-A', props: { uuid: 'conduit-1' } });
});

afterEach(() => {
	getConduit.mockReset();
	getConduitList.mockReset();
	updateConduit.mockReset();
	deleteConduit.mockReset();
	drawerStore.close();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('ConduitAttributeCard', () => {
	test('should load the conduit and prefill the form', async () => {
		renderCard();

		expect(await screen.findByDisplayValue('Rohr-A')).toBeInTheDocument();
		expect(screen.getByDisplayValue('AR-12')).toBeInTheDocument();
		expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
		expect(getConduit).toHaveBeenCalledWith('conduit-1');
	});

	test('should save through the command with the selected ids and retitle the drawer', async () => {
		const user = userEvent.setup();
		renderCard();
		const name = await screen.findByDisplayValue('Rohr-A');

		await user.clear(name);
		await user.type(name, 'Rohr-Neu');
		conduitForm().requestSubmit();

		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
		expect(updateConduit).toHaveBeenCalledWith({
			uuid: 'conduit-1',
			name: 'Rohr-Neu',
			outer_conduit: 'AR-12',
			date: '2024-01-01',
			conduit_type_id: 4,
			status_id: 2,
			network_level_id: 3,
			owner_id: 5,
			constructor_id: undefined,
			manufacturer_id: 6,
			flag_id: 7
		});
		expect(get(drawerStore).title).toBe('Rohr-Neu');
	});

	test('should toast the backend message when the update is rejected', async () => {
		updateConduit.mockReturnValue(commandFailure(httpError(400, 'name: too long')));
		renderCard();
		await screen.findByDisplayValue('Rohr-A');

		conduitForm().requestSubmit();

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'name: too long' })
			)
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
		expect(get(drawerStore).title).toBe('Rohr-A');
	});

	test('should delete the conduit and close the drawer on confirm', async () => {
		const user = userEvent.setup();
		renderCard();
		await screen.findByDisplayValue('Rohr-A');

		await user.click(screen.getByText('action_delete_conduit'));
		await user.click(await screen.findByText('common_delete'));

		await vi.waitFor(() => expect(deleteConduit).toHaveBeenCalledWith('conduit-1'));
		await vi.waitFor(() => expect(get(drawerStore).open).toBe(false));
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should keep the drawer open and toast when the delete is rejected', async () => {
		const user = userEvent.setup();
		deleteConduit.mockReturnValue(commandFailure(httpError(409, 'Conduit is in use')));
		renderCard();
		await screen.findByDisplayValue('Rohr-A');

		await user.click(screen.getByText('action_delete_conduit'));
		await user.click(await screen.findByText('common_delete'));

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Conduit is in use' })
			)
		);
		expect(get(drawerStore).open).toBe(true);
	});
});
