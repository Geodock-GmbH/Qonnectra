import type { ConduitListRow } from '$lib/remote/conduit/conduit-data';
import { get } from 'svelte/store';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';

import PipeTable from './PipeTable.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

vi.mock('$app/state', () => ({
	page: { params: { projectId: 'proj-42' } }
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

// Overrides are untyped: an object literal without `constructor` cannot be
// checked against a type whose `constructor` is a string.
function makePipe(overrides: Record<string, string> = {}): ConduitListRow {
	return {
		value: 'uuid-1',
		name: 'Rohr-A',
		conduit_type: 'Typ-1',
		outer_conduit: 'AR-12',
		status: 'geplant',
		network_level: 'NE3',
		owner: 'Firma-Owner',
		constructor: 'Firma-Bau',
		manufacturer: 'Firma-Herst',
		date: '2024-01-01',
		flag: 'Flag-X',
		...overrides
	};
}

const pagination = { totalCount: 2, pageSize: 25, page: 1 };

afterEach(() => {
	gotoMock.mockReset();
	drawerStore.close();
});

function desktopTable() {
	const view = screen.getByTestId('conduit-desktop-view');
	return within(view).getByRole('table');
}

describe('PipeTable', () => {
	test('should render a data row per pipe with its cell values', () => {
		render(PipeTable, {
			pipes: [
				makePipe({ value: 'uuid-1', name: 'Rohr-A' }),
				makePipe({ value: 'uuid-2', name: 'Rohr-B', status: 'gebaut' })
			],
			pagination
		});

		const table = desktopTable();
		expect(within(table).getByText('Rohr-A')).toBeInTheDocument();
		expect(within(table).getByText('Rohr-B')).toBeInTheDocument();
		expect(within(table).getByText('gebaut')).toBeInTheDocument();
		expect(within(table).queryByText('message_no_results_found')).not.toBeInTheDocument();
	});

	test('should render column headers from the config', () => {
		render(PipeTable, { pipes: [makePipe()], pagination });

		const table = desktopTable();
		const headerRow = within(table).getAllByRole('row')[0];
		expect(within(headerRow).getByText('common_name')).toBeInTheDocument();
		expect(within(headerRow).getByText('form_conduit_type')).toBeInTheDocument();
		expect(within(headerRow).getByText('form_flag')).toBeInTheDocument();
	});

	test('should show the empty state when there are no pipes', () => {
		render(PipeTable, { pipes: [], pagination: { totalCount: 0, pageSize: 25, page: 1 } });

		const table = desktopTable();
		expect(within(table).getByText('message_no_results_found')).toBeInTheDocument();
	});

	test('should filter rows via the per-column filter input', async () => {
		const user = userEvent.setup();
		render(PipeTable, {
			pipes: [
				makePipe({ value: 'uuid-1', name: 'Rohr-A' }),
				makePipe({ value: 'uuid-2', name: 'Rohr-B' })
			],
			pagination
		});

		const table = desktopTable();
		await user.type(document.getElementById('filter-name') as HTMLInputElement, 'Rohr-B');

		expect(within(table).queryByText('Rohr-A')).not.toBeInTheDocument();
		expect(within(table).getByText('Rohr-B')).toBeInTheDocument();
	});

	test('should sort rows ascending then descending when a header is clicked', async () => {
		const user = userEvent.setup();
		render(PipeTable, {
			pipes: [
				makePipe({ value: 'uuid-b', name: 'Bochum' }),
				makePipe({ value: 'uuid-a', name: 'Aachen' })
			],
			pagination
		});

		const nameHeader = within(desktopTable()).getByRole('button', { name: /common_name/ });

		await user.click(nameHeader);
		let cells = within(desktopTable()).getAllByText(/Aachen|Bochum/);
		expect(cells[0]).toHaveTextContent('Aachen');
		expect(cells[1]).toHaveTextContent('Bochum');

		await user.click(nameHeader);
		cells = within(desktopTable()).getAllByText(/Aachen|Bochum/);
		expect(cells[0]).toHaveTextContent('Bochum');
		expect(cells[1]).toHaveTextContent('Aachen');
	});

	test('should open the drawer with the conduit uuid and name when a row is clicked', async () => {
		const user = userEvent.setup();
		render(PipeTable, { pipes: [makePipe({ value: 'uuid-1', name: 'Rohr-A' })], pagination });

		await user.click(within(desktopTable()).getByText('Rohr-A'));

		const drawer = get(drawerStore);
		expect(drawer.open).toBe(true);
		expect(drawer.title).toBe('Rohr-A');
		expect(drawer.props).toEqual({ uuid: 'uuid-1' });
		expect(drawer.component).not.toBeNull();
	});

	test('should navigate to the requested page on pagination change', async () => {
		const user = userEvent.setup();
		render(PipeTable, {
			pipes: [makePipe()],
			pagination: { totalCount: 100, pageSize: 10, page: 1 }
		});

		await user.click(screen.getByText('2'));

		expect(gotoMock).toHaveBeenCalled();
		const target = gotoMock.mock.calls[0][0] as string;
		expect(target).toContain('/conduit/proj-42?');
		expect(target).toContain('page=2');
	});
});
