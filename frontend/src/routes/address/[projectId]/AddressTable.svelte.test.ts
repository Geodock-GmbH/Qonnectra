import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import AddressTable from './AddressTable.svelte';

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

function makeAddress(overrides: Record<string, unknown> = {}) {
	return {
		value: 'uuid-1',
		id_address: 'A-100',
		street: 'Hauptstraße',
		housenumber: '12',
		house_number_suffix: 'a',
		zip_code: '10115',
		city: 'Berlin',
		district: 'Mitte',
		status_development: 'geplant',
		flag: 'rot',
		...overrides
	};
}

const defaultPagination = { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 };

function renderTable(addresses: Record<string, unknown>[], pagination = defaultPagination) {
	return render(AddressTable, { addresses, pagination });
}

/**
 * Returns the desktop data rows (tbody rows that contain address cells).
 */
function getDesktopBody() {
	const table = document.querySelector('table') as HTMLTableElement;
	return table.querySelector('tbody') as HTMLTableSectionElement;
}

beforeEach(() => {
	// jsdom reports desktop-width so the md:block table is rendered/visible.
	window.history.pushState({}, '', '/address/proj-42');
});

afterEach(() => {
	gotoMock.mockReset();
});

describe('AddressTable', () => {
	test('should render a row per address with cell values', () => {
		renderTable([
			makeAddress({ value: 'uuid-1', id_address: 'A-100', street: 'Hauptstraße', city: 'Berlin' }),
			makeAddress({ value: 'uuid-2', id_address: 'A-200', street: 'Nebenweg', city: 'Hamburg' })
		]);

		const body = getDesktopBody();
		expect(within(body).getByText('A-100')).toBeInTheDocument();
		expect(within(body).getByText('A-200')).toBeInTheDocument();
		expect(within(body).getByText('Hauptstraße')).toBeInTheDocument();
		expect(within(body).getByText('Nebenweg')).toBeInTheDocument();
		expect(within(body).getByText('Berlin')).toBeInTheDocument();
		expect(within(body).getByText('Hamburg')).toBeInTheDocument();
		expect(within(body).getAllByRole('row')).toHaveLength(2);
	});

	test('should render the configured column headers', () => {
		renderTable([makeAddress()]);

		const headers = screen.getAllByRole('button', { name: /form_/ });
		const labels = headers.map((h) => h.textContent?.trim());
		expect(labels).toContain('form_id_address');
		expect(labels).toContain('form_street');
		expect(labels).toContain('form_city');
		expect(labels).toContain('form_flag');
	});

	test('should render the empty state when there are no addresses', () => {
		renderTable([], { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });

		const body = getDesktopBody();
		expect(within(body).getByText('message_no_results_found')).toBeInTheDocument();
		expect(within(body).queryByText('A-100')).not.toBeInTheDocument();
	});

	test('should navigate to the address detail page on row click', async () => {
		const user = userEvent.setup();
		renderTable([makeAddress({ value: 'uuid-99', id_address: 'A-999' })]);

		const body = getDesktopBody();
		const row = within(body).getByText('A-999').closest('tr') as HTMLTableRowElement;
		await user.click(row);

		expect(gotoMock).toHaveBeenCalledWith('/address/proj-42/uuid-99');
	});

	test('should filter rows by a column filter input', async () => {
		const user = userEvent.setup();
		renderTable([
			makeAddress({ value: 'uuid-1', id_address: 'A-100', city: 'Berlin' }),
			makeAddress({ value: 'uuid-2', id_address: 'A-200', city: 'Hamburg' })
		]);

		const cityFilter = document.getElementById('filter-city') as HTMLInputElement;
		await user.type(cityFilter, 'Berlin');

		const body = getDesktopBody();
		expect(within(body).getByText('A-100')).toBeInTheDocument();
		expect(within(body).queryByText('A-200')).not.toBeInTheDocument();
	});

	test('should show the empty state when a filter matches nothing', async () => {
		const user = userEvent.setup();
		renderTable([makeAddress({ id_address: 'A-100', city: 'Berlin' })]);

		const cityFilter = document.getElementById('filter-city') as HTMLInputElement;
		await user.type(cityFilter, 'Zürich-Unbekannt');

		const body = getDesktopBody();
		expect(within(body).queryByText('A-100')).not.toBeInTheDocument();
		expect(within(body).getByText('message_no_results_found')).toBeInTheDocument();
	});

	test('should sort rows ascending then descending when a header is clicked', async () => {
		const user = userEvent.setup();
		renderTable([
			makeAddress({ value: 'uuid-b', id_address: 'B', city: 'Bochum' }),
			makeAddress({ value: 'uuid-a', id_address: 'A', city: 'Aachen' })
		]);

		const cityHeader = screen.getByRole('button', { name: /form_city/ });

		// Ascending: Aachen before Bochum.
		await user.click(cityHeader);
		let cells = within(getDesktopBody()).getAllByText(/Aachen|Bochum/);
		expect(cells[0]).toHaveTextContent('Aachen');
		expect(cells[1]).toHaveTextContent('Bochum');

		// Descending: Bochum before Aachen.
		await user.click(cityHeader);
		cells = within(getDesktopBody()).getAllByText(/Aachen|Bochum/);
		expect(cells[0]).toHaveTextContent('Bochum');
		expect(cells[1]).toHaveTextContent('Aachen');
	});

	test('should sort housenumber numerically rather than lexicographically', async () => {
		const user = userEvent.setup();
		renderTable([
			makeAddress({ value: 'uuid-2', id_address: 'H2', housenumber: '2' }),
			makeAddress({ value: 'uuid-10', id_address: 'H10', housenumber: '10' })
		]);

		const numberHeader = screen.getByRole('button', { name: /form_housenumber/ });
		await user.click(numberHeader);

		const body = getDesktopBody();
		const ids = within(body).getAllByText(/^H(2|10)$/);
		// Numeric sort puts 2 before 10 (lexicographic would put 10 first).
		expect(ids[0]).toHaveTextContent('H2');
		expect(ids[1]).toHaveTextContent('H10');
	});

	test('should render the total result count in the pagination footer', () => {
		renderTable([makeAddress()], { page: 1, pageSize: 50, totalCount: 137, totalPages: 3 });

		const countSpan = screen.getByText(
			(_content, el) =>
				el?.tagName === 'SPAN' &&
				el?.textContent?.replace(/\s+/g, ' ').trim() === '137 common_results:137'
		);
		expect(countSpan).toBeInTheDocument();
	});
});
