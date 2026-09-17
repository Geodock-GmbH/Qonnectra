import type { AddressRecord } from '$lib/remote/address/address-data';
import { error } from '@sveltejs/kit';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import AddressForm from './AddressForm.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

// Reads and writes run through the address remote modules; mocking them
// makes the form's calls observable without a server.
const getAddress = vi.fn();
const getAddressLinks = vi.fn();
const updateAddress = vi.fn();
const regenerateAddressId = vi.fn();
const deleteAddress = vi.fn();

vi.mock('$lib/remote/address/addresses.remote', () => ({
	getAddress: (...args: unknown[]) => getAddress(...args),
	getAddressLinks: (...args: unknown[]) => getAddressLinks(...args),
	updateAddress: (...args: unknown[]) => updateAddress(...args),
	regenerateAddressId: (...args: unknown[]) => regenerateAddressId(...args),
	deleteAddress: (...args: unknown[]) => deleteAddress(...args)
}));

vi.mock('$lib/remote/address/attribute-options.remote', () => ({
	getStatusDevelopmentOptions: vi.fn().mockResolvedValue([{ value: 3, label: 'Planned' }]),
	getFlagOptions: vi.fn().mockResolvedValue([{ value: 4, label: 'Priority' }])
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
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

/**
 * Builds a Kit HttpError the way a remote function's `error()` call does.
 */
function httpError(status: number, message: string): unknown {
	try {
		error(status, message);
	} catch (e) {
		return e;
	}
	return null;
}

function makeAddress(overrides: Partial<AddressRecord> = {}): AddressRecord {
	return {
		uuid: 'addr-1',
		id_address: 'ABC1234',
		id_address_2: null,
		street: 'Main St',
		housenumber: 12,
		house_number_suffix: 'a',
		zip_code: '10115',
		city: 'Berlin',
		district: 'Mitte',
		status_development: { id: 3, status: 'Planned' },
		flag: { id: 4, flag: 'Priority' },
		project: { id: 1, project: 'Demo' },
		geom_3857: null,
		...overrides
	};
}

function renderForm(address = makeAddress(), nodes: unknown[] = []) {
	getAddress.mockResolvedValue(address);
	getAddressLinks.mockResolvedValue({ nodes, microducts: [] });
	return render(BoundaryFixture, {
		props: { component: AddressForm, props: { uuid: 'addr-1', projectId: 'proj-1' } }
	});
}

function idInput() {
	return document.getElementById('id-address') as HTMLInputElement;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	updateAddress.mockImplementation(async (input: Partial<AddressRecord>) => ({
		...makeAddress(),
		...input
	}));
	regenerateAddressId.mockResolvedValue(makeAddress({ id_address: 'NEW1234' }));
	deleteAddress.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	gotoMock.mockReset();
	getAddress.mockReset();
	getAddressLinks.mockReset();
	updateAddress.mockReset();
	regenerateAddressId.mockReset();
	deleteAddress.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('AddressForm', () => {
	test('should load the address and prefill the form', async () => {
		renderForm();

		expect(await screen.findByDisplayValue('Main St')).toBeInTheDocument();
		expect(idInput().value).toBe('ABC1234');
		expect(screen.getByDisplayValue('10115')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Demo')).toHaveAttribute('readonly');
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main St 12a');
		expect(getAddress).toHaveBeenCalledWith('addr-1');
		expect(getAddressLinks).toHaveBeenCalledWith('addr-1');
	});

	test('should save the edited fields through the command and take back the ids', async () => {
		const user = userEvent.setup();
		updateAddress.mockResolvedValue(makeAddress({ id_address: 'ZZZ9999', street: 'New St' }));
		renderForm();
		const street = await screen.findByDisplayValue('Main St');

		await user.clear(street);
		await user.type(street, 'New St');
		await user.click(screen.getAllByRole('button', { name: /common_save/ })[0]);

		expect(updateAddress).toHaveBeenCalledWith(
			expect.objectContaining({
				uuid: 'addr-1',
				street: 'New St',
				housenumber: 12,
				status_development_id: 3,
				flag_id: 4,
				id_address: 'ABC1234',
				id_address_2: ''
			})
		);
		await vi.waitFor(() => expect(idInput().value).toBe('ZZZ9999'));
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should show the backend message when the save is rejected', async () => {
		const user = userEvent.setup();
		updateAddress.mockRejectedValue(httpError(400, 'street: This field is required.'));
		renderForm();
		await screen.findByDisplayValue('Main St');

		await user.click(screen.getAllByRole('button', { name: /common_save/ })[0]);

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'street: This field is required.' })
			)
		);
	});

	test('should disable delete while the address is linked to a node', async () => {
		renderForm(makeAddress(), [{ uuid: 'n-1', name: 'Node', parentNodeName: '' }]);
		await screen.findByDisplayValue('Main St');

		for (const button of screen.getAllByRole('button', { name: /action_delete/ })) {
			expect(button).toBeDisabled();
		}
	});

	test('should delete after confirmation and navigate back to the list', async () => {
		const user = userEvent.setup();
		renderForm();
		await screen.findByDisplayValue('Main St');

		await user.click(screen.getAllByRole('button', { name: /action_delete/ })[0]);
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'action_delete' }));

		expect(deleteAddress).toHaveBeenCalledWith('addr-1');
		await vi.waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/address/proj-1'));
	});

	test('should regenerate the id after confirmation and show the new one', async () => {
		const user = userEvent.setup();
		renderForm();
		await screen.findByDisplayValue('Main St');

		await user.click(screen.getByRole('button', { name: /action_regenerate_id/ }));
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'action_regenerate_id' }));

		expect(regenerateAddressId).toHaveBeenCalledWith('addr-1');
		await vi.waitFor(() => expect(idInput().value).toBe('NEW1234'));
	});
});
