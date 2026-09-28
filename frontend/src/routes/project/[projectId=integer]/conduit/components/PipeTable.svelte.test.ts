import type { ConduitListRow } from '$lib/remote/conduit/conduit-data';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import PipeTable from './PipeTable.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

vi.mock('$app/state', () => ({
	page: { params: { projectId: 'proj-42' }, url: new URL('http://localhost/conduit/proj-42') }
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
		funding_status: null,
		...overrides
	};
}

const pagination = { totalCount: 2, pageSize: 25, page: 1 };

afterEach(() => {
	gotoMock.mockReset();
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
		expect(within(headerRow).getByText('form_funding_status')).toBeInTheDocument();
	});

	test('should label the funding status and filter by that label', async () => {
		const user = userEvent.setup();
		render(PipeTable, {
			pipes: [
				{ ...makePipe({ value: 'uuid-1', name: 'Rohr-A' }), funding_status: true },
				{ ...makePipe({ value: 'uuid-2', name: 'Rohr-B' }), funding_status: false },
				makePipe({ value: 'uuid-3', name: 'Rohr-C' })
			],
			pagination
		});

		const table = desktopTable();
		expect(within(table).getByText('common_yes')).toBeInTheDocument();
		expect(within(table).getByText('common_no')).toBeInTheDocument();

		await user.type(document.getElementById('filter-funding_status') as HTMLInputElement, 'yes');

		expect(within(table).getByText('Rohr-A')).toBeInTheDocument();
		expect(within(table).queryByText('Rohr-B')).not.toBeInTheDocument();
		expect(within(table).queryByText('Rohr-C')).not.toBeInTheDocument();
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

	test('should open the drawer by naming the conduit in the URL when a row is clicked', async () => {
		const user = userEvent.setup();
		render(PipeTable, { pipes: [makePipe({ value: 'uuid-1', name: 'Rohr-A' })], pagination });

		await user.click(within(desktopTable()).getByText('Rohr-A'));

		expect(gotoMock).toHaveBeenCalledWith('/conduit/proj-42?feature=conduit%3Auuid-1', {
			keepFocus: true,
			noScroll: true,
			replaceState: false
		});
	});

	test('should highlight the row of the conduit open in the drawer', () => {
		render(PipeTable, {
			pipes: [
				makePipe({ value: 'uuid-1', name: 'Rohr-A' }),
				makePipe({ value: 'uuid-2', name: 'Rohr-B' })
			],
			pagination,
			selectedUuid: 'uuid-2'
		});

		const rows = within(desktopTable()).getAllByRole('row');
		const selected = rows.filter((row) => row.getAttribute('aria-selected') === 'true');
		expect(selected).toHaveLength(1);
		expect(selected[0]).toHaveTextContent('Rohr-B');
	});

	test('should navigate to the requested page on pagination change', async () => {
		const user = userEvent.setup();
		render(PipeTable, {
			pipes: [makePipe()],
			pagination: { totalCount: 100, pageSize: 10, page: 1 }
		});

		await user.click(screen.getByText('2'));

		expect(gotoMock).toHaveBeenCalledWith('/conduit/proj-42?page=2', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});
});
