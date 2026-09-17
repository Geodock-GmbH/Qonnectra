import type { ResidentialUnit } from '$lib/types';
import { error } from '@sveltejs/kit';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import ResidentialUnitForm from './ResidentialUnitForm.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

const getResidentialUnit = vi.fn();
const updateResidentialUnit = vi.fn();
const deleteResidentialUnit = vi.fn();
const regenerateResidentialUnitId = vi.fn();

vi.mock('$lib/remote/address/residential-units.remote', () => ({
	getResidentialUnit: (...args: unknown[]) => getResidentialUnit(...args),
	updateResidentialUnit: (...args: unknown[]) => updateResidentialUnit(...args),
	deleteResidentialUnit: (...args: unknown[]) => deleteResidentialUnit(...args),
	regenerateResidentialUnitId: (...args: unknown[]) => regenerateResidentialUnitId(...args)
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

function makeUnit(overrides: Partial<ResidentialUnit> = {}): ResidentialUnit {
	return {
		uuid: 'ru-1',
		uuid_address: 'addr-1',
		uuid_address_id: 'addr-1',
		id_residential_unit: 'RU-001',
		floor: 2,
		side: 'left',
		building_section: 'B',
		residential_unit_type: { id: 1, residential_unit_type: 'Apartment' },
		status: { id: 2, status: 'Active' },
		external_id_1: 'ext-1',
		external_id_2: null,
		resident_name: 'Jane Doe',
		resident_recorded_date: '2024-01-01',
		ready_for_service: null,
		...overrides
	} as ResidentialUnit;
}

function renderForm(unit = makeUnit()) {
	getResidentialUnit.mockResolvedValue(unit);
	return render(BoundaryFixture, {
		props: {
			component: ResidentialUnitForm,
			props: { unitUuid: 'ru-1', addressUuid: 'addr-1', projectId: 'proj-1' }
		}
	});
}

function idInput() {
	return document.getElementById('id-residential-unit') as HTMLInputElement;
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	updateResidentialUnit.mockResolvedValue(makeUnit());
	regenerateResidentialUnitId.mockResolvedValue(makeUnit({ id_residential_unit: 'NEW-RU' }));
	deleteResidentialUnit.mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	gotoMock.mockReset();
	getResidentialUnit.mockReset();
	updateResidentialUnit.mockReset();
	deleteResidentialUnit.mockReset();
	regenerateResidentialUnitId.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('ResidentialUnitForm', () => {
	test('should load the unit and prefill the form', async () => {
		renderForm();

		expect(await screen.findByDisplayValue('RU-001')).toBeInTheDocument();
		expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
		expect((document.getElementById('unit-floor') as HTMLInputElement).value).toBe('2');
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('RU-001');
		expect(getResidentialUnit).toHaveBeenCalledWith('ru-1');
	});

	test('should save the edited fields through the command', async () => {
		const user = userEvent.setup();
		renderForm();
		const side = await screen.findByDisplayValue('left');

		await user.clear(side);
		await user.type(side, 'right');
		await user.click(screen.getAllByRole('button', { name: /common_save/ })[0]);

		expect(updateResidentialUnit).toHaveBeenCalledWith({
			unitUuid: 'ru-1',
			id_residential_unit: 'RU-001',
			floor: 2,
			side: 'right',
			building_section: 'B',
			residential_unit_type_id: 1,
			status_id: 2,
			external_id_1: 'ext-1',
			external_id_2: '',
			resident_name: 'Jane Doe',
			resident_recorded_date: '2024-01-01',
			ready_for_service: ''
		});
		await vi.waitFor(() => expect(globalToaster.success).toHaveBeenCalled());
	});

	test('should show the backend message when the save is rejected', async () => {
		const user = userEvent.setup();
		updateResidentialUnit.mockRejectedValue(httpError(400, 'floor: Must be an integer'));
		renderForm();
		await screen.findByDisplayValue('RU-001');

		await user.click(screen.getAllByRole('button', { name: /common_save/ })[0]);

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'floor: Must be an integer' })
			)
		);
	});

	test('should delete after confirmation and navigate back to the address', async () => {
		const user = userEvent.setup();
		renderForm();
		await screen.findByDisplayValue('RU-001');

		await user.click(screen.getAllByRole('button', { name: /action_delete/ })[0]);
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'action_delete' }));

		expect(deleteResidentialUnit).toHaveBeenCalledWith({ unitUuid: 'ru-1', addressUuid: 'addr-1' });
		await vi.waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/address/proj-1/addr-1'));
	});

	test('should regenerate the id after confirmation and show the new one', async () => {
		const user = userEvent.setup();
		renderForm();
		await screen.findByDisplayValue('RU-001');

		await user.click(screen.getByRole('button', { name: /action_regenerate_id/ }));
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'action_regenerate_id' }));

		expect(regenerateResidentialUnitId).toHaveBeenCalledWith('ru-1');
		await vi.waitFor(() => expect(idInput().value).toBe('NEW-RU'));
	});
});
