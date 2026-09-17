import { error } from '@sveltejs/kit';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import ResidentialUnitModal from './ResidentialUnitModal.svelte';

const createResidentialUnit = vi.fn();

vi.mock('$lib/remote/address/residential-units.remote', () => ({
	createResidentialUnit: (...args: unknown[]) => createResidentialUnit(...args)
}));

vi.mock('$lib/remote/address/attribute-options.remote', () => ({
	getResidentialUnitTypeOptions: vi.fn().mockResolvedValue([{ value: 1, label: 'Apartment' }]),
	getResidentialUnitStatusOptions: vi.fn().mockResolvedValue([{ value: 2, label: 'Active' }])
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

function renderModal() {
	return render(BoundaryFixture, {
		props: { component: ResidentialUnitModal, props: { addressUuid: 'addr-1', openModal: true } }
	});
}

beforeEach(() => {
	createResidentialUnit.mockResolvedValue({ uuid: 'ru-new' });
});

afterEach(() => {
	createResidentialUnit.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('ResidentialUnitModal', () => {
	test('should load the option lists into the type and status comboboxes', async () => {
		renderModal();

		const comboboxes = await screen.findAllByTestId('generic-combobox');
		expect(comboboxes).toHaveLength(2);
		expect(screen.getByRole('option', { name: 'Apartment' })).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Active' })).toBeInTheDocument();
	});

	test('should create the unit with the entered fields and close on success', async () => {
		const user = userEvent.setup();
		renderModal();
		await screen.findAllByTestId('generic-combobox');

		await user.type(screen.getByLabelText('form_id_residential_unit'), 'RU-9');
		await user.type(screen.getByLabelText('form_floor'), '3');
		await user.type(screen.getByLabelText('form_residential_unit_side'), 'left');
		await fireEvent.submit(document.getElementById('residential-unit-form') as HTMLFormElement);

		expect(createResidentialUnit).toHaveBeenCalledWith({
			addressUuid: 'addr-1',
			id_residential_unit: 'RU-9',
			floor: 3,
			side: 'left',
			building_section: undefined,
			external_id_1: undefined,
			external_id_2: undefined,
			residential_unit_type_id: undefined,
			status_id: undefined
		});
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
		await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('should show the backend message when the create is rejected', async () => {
		createResidentialUnit.mockRejectedValue(httpError(400, 'floor: Must be an integer'));
		renderModal();
		await screen.findAllByTestId('generic-combobox');

		await fireEvent.submit(document.getElementById('residential-unit-form') as HTMLFormElement);

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'floor: Must be an integer' })
			)
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});
});
