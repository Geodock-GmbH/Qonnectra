import type { ResidentialUnit } from '$lib/types';
import { error } from '@sveltejs/kit';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import ResidentialUnitsSection from './ResidentialUnitsSection.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

// The section awaits the unit list query and deletes through the command;
// both are mocked so the calls are observable.
const getResidentialUnits = vi.fn();
const deleteResidentialUnit = vi.fn();

vi.mock('$lib/remote/address/residential-units.remote', () => ({
	getResidentialUnits: (...args: unknown[]) => getResidentialUnits(...args),
	deleteResidentialUnit: (...args: unknown[]) => deleteResidentialUnit(...args),
	createResidentialUnit: vi.fn()
}));

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
		residential_unit_type: { id: 1, residential_unit_type: 'Apartment' },
		status: { id: 1, status: 'Active' },
		...overrides
	} as ResidentialUnit;
}

function renderSection(units: ResidentialUnit[]) {
	getResidentialUnits.mockResolvedValue(units);
	return render(BoundaryFixture, {
		props: {
			component: ResidentialUnitsSection,
			props: { addressUuid: 'addr-1', projectId: 'proj-1' }
		}
	});
}

/**
 * Returns the desktop table body.
 */
function getDesktopBody() {
	const table = document.querySelector('table') as HTMLTableElement;
	return table.querySelector('tbody') as HTMLTableSectionElement;
}

beforeEach(() => {
	deleteResidentialUnit.mockResolvedValue(undefined);
});

afterEach(() => {
	gotoMock.mockReset();
	getResidentialUnits.mockReset();
	deleteResidentialUnit.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('ResidentialUnitsSection', () => {
	test('should show the boundary placeholder and then query and render the units', async () => {
		renderSection([makeUnit(), makeUnit({ uuid: 'ru-2', id_residential_unit: 'RU-002' })]);

		expect(screen.getByTestId('boundary-pending')).toBeInTheDocument();

		await screen.findAllByText('RU-001');
		const body = getDesktopBody();
		expect(within(body).getByText('RU-001')).toBeInTheDocument();
		expect(within(body).getByText('RU-002')).toBeInTheDocument();
		expect(getResidentialUnits).toHaveBeenCalledWith('addr-1');
		expect(screen.queryByTestId('boundary-pending')).not.toBeInTheDocument();
	});

	test('should render the empty state when there are no units', async () => {
		renderSection([]);

		expect(await screen.findByText('message_no_residential_units')).toBeInTheDocument();
	});

	test('should navigate to the unit detail page on row click', async () => {
		const user = userEvent.setup();
		renderSection([makeUnit()]);

		await screen.findAllByText('RU-001');
		const row = within(getDesktopBody()).getByText('RU-001').closest('tr') as HTMLTableRowElement;
		await user.click(row);

		expect(gotoMock).toHaveBeenCalledWith('/address/proj-1/addr-1/unit/ru-1');
	});

	test('should filter rows by a column filter input', async () => {
		const user = userEvent.setup();
		renderSection([makeUnit(), makeUnit({ uuid: 'ru-2', id_residential_unit: 'RU-002' })]);
		await screen.findAllByText('RU-001');

		const [idFilter] = screen.getAllByPlaceholderText('common_search');
		await user.type(idFilter, '002');

		const body = getDesktopBody();
		expect(within(body).queryByText('RU-001')).not.toBeInTheDocument();
		expect(within(body).getByText('RU-002')).toBeInTheDocument();
	});

	test('should delete a unit after confirmation through the command', async () => {
		const user = userEvent.setup();
		renderSection([makeUnit()]);
		await screen.findAllByText('RU-001');

		const [rowDelete] = within(getDesktopBody()).getAllByRole('button', { name: 'action_delete' });
		await user.click(rowDelete);

		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'action_delete' }));

		expect(deleteResidentialUnit).toHaveBeenCalledWith({ unitUuid: 'ru-1', addressUuid: 'addr-1' });
		expect(globalToaster.success).toHaveBeenCalled();
	});

	test('should show the backend message when the delete is rejected', async () => {
		const user = userEvent.setup();
		deleteResidentialUnit.mockRejectedValue(httpError(409, 'Unit still spliced'));
		renderSection([makeUnit()]);
		await screen.findAllByText('RU-001');

		const [rowDelete] = within(getDesktopBody()).getAllByRole('button', { name: 'action_delete' });
		await user.click(rowDelete);
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', { name: 'action_delete' }));

		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Unit still spliced' })
			)
		);
	});

	test('should render the failed state when the query rejects', async () => {
		getResidentialUnits.mockRejectedValue(new Error('backend down'));
		render(BoundaryFixture, {
			props: {
				component: ResidentialUnitsSection,
				props: { addressUuid: 'addr-1', projectId: 'proj-1' }
			}
		});

		expect(await screen.findByTestId('boundary-failed')).toHaveTextContent('backend down');
	});
});
