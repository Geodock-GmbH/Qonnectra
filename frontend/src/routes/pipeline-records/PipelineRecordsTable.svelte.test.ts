import { goto } from '$app/navigation';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import PipelineRecordsTable from './PipelineRecordsTable.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
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

vi.mock('$lib/paraglide/runtime', () => ({
	getLocale: () => 'de'
}));

function makeRecord(overrides: Record<string, unknown> = {}) {
	return {
		value: 'rec-1',
		project_name: 'Fiber North',
		type_of_work: 'Excavation',
		request_reason: 'Expansion',
		organisation: 'Acme Telecom',
		name: 'Jane Doe',
		created_at: '2026-01-15T10:30:00Z',
		modified_at: '2026-02-20T14:45:00Z',
		...overrides
	};
}

const pagination = { totalCount: 2, pageSize: 20, page: 1 };

/** Returns the desktop table's body (both desktop + mobile views live in the DOM under jsdom). */
function desktopTable() {
	const view = screen.getByTestId('pipeline-records-desktop-view');
	return within(view);
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.mocked(goto).mockClear();
});

describe('PipelineRecordsTable', () => {
	test('renders a row per record with cell values', () => {
		const records = [
			makeRecord(),
			makeRecord({
				value: 'rec-2',
				project_name: 'Fiber South',
				organisation: 'Globex',
				name: 'John Roe'
			})
		];

		render(PipelineRecordsTable, { records, pagination });

		const table = desktopTable();
		expect(table.getByText('Fiber North')).toBeInTheDocument();
		expect(table.getByText('Fiber South')).toBeInTheDocument();
		expect(table.getByText('Acme Telecom')).toBeInTheDocument();
		expect(table.getByText('Globex')).toBeInTheDocument();
		expect(table.getByText('Jane Doe')).toBeInTheDocument();
		expect(table.getByText('John Roe')).toBeInTheDocument();
	});

	test('renders all configured column headers', () => {
		render(PipelineRecordsTable, { records: [makeRecord()], pagination });

		const table = desktopTable();
		for (const header of [
			'form_project:1',
			'form_type_of_work',
			'form_request_reason',
			'form_organisation',
			'form_name',
			'common_created',
			'common_modified'
		]) {
			expect(table.getByText(header)).toBeInTheDocument();
		}
	});

	test('shows the empty state when there are no records', () => {
		render(PipelineRecordsTable, { records: [], pagination: { ...pagination, totalCount: 0 } });

		expect(desktopTable().getByText('message_no_results_found')).toBeInTheDocument();
	});

	test('formats date columns with the locale formatter', () => {
		render(PipelineRecordsTable, { records: [makeRecord()], pagination });

		// The component formats with `toLocaleString` in the host timezone, so derive
		// the expected strings the same way to keep the assertion timezone-agnostic.
		const format = (iso: string) =>
			new Date(iso).toLocaleString('de', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});

		const table = desktopTable();
		expect(table.getByText(format('2026-01-15T10:30:00Z'))).toBeInTheDocument();
		expect(table.getByText(format('2026-02-20T14:45:00Z'))).toBeInTheDocument();
	});

	test('filters rows by a column filter input', async () => {
		const user = userEvent.setup();
		const records = [
			makeRecord({ value: 'rec-1', project_name: 'Fiber North' }),
			makeRecord({ value: 'rec-2', project_name: 'Fiber South' })
		];

		render(PipelineRecordsTable, { records, pagination });

		const table = desktopTable();
		const filterInputs = table.getAllByPlaceholderText('common_search');
		await user.type(filterInputs[0], 'North');

		expect(table.getByText('Fiber North')).toBeInTheDocument();
		expect(table.queryByText('Fiber South')).not.toBeInTheDocument();
	});

	test('sorts a column ascending then descending on repeated header clicks', async () => {
		const user = userEvent.setup();
		const records = [
			makeRecord({ value: 'rec-1', project_name: 'Bravo' }),
			makeRecord({ value: 'rec-2', project_name: 'Alpha' })
		];

		render(PipelineRecordsTable, { records, pagination });

		const table = desktopTable();
		const projectHeader = table.getByText('form_project:1').closest('th') as HTMLElement;

		function projectColumnOrder() {
			return table.getAllByText(/^(Alpha|Bravo)$/).map((el) => el.textContent?.trim());
		}

		expect(projectColumnOrder()).toEqual(['Bravo', 'Alpha']);

		await user.click(projectHeader);
		expect(projectColumnOrder()).toEqual(['Alpha', 'Bravo']);

		await user.click(projectHeader);
		expect(projectColumnOrder()).toEqual(['Bravo', 'Alpha']);
	});

	test('navigates to the record edit page on row click', async () => {
		const user = userEvent.setup();

		render(PipelineRecordsTable, {
			records: [makeRecord({ value: 'rec-42' })],
			pagination
		});

		await user.click(desktopTable().getByText('Fiber North'));

		expect(goto).toHaveBeenCalledWith('/pipeline-records/rec-42');
	});

	test('renders the paginated total count', () => {
		render(PipelineRecordsTable, {
			records: [makeRecord()],
			pagination: { totalCount: 7, pageSize: 20, page: 1 }
		});

		const count = screen.getByTestId('pagination-count');
		expect(count).toHaveTextContent('7');
		expect(count).toHaveTextContent('common_results:7');
	});

	test('filters the mobile card view by the shared search input', async () => {
		const user = userEvent.setup();
		const records = [
			makeRecord({ value: 'rec-1', project_name: 'Fiber North' }),
			makeRecord({ value: 'rec-2', project_name: 'Fiber South' })
		];

		render(PipelineRecordsTable, { records, pagination });

		const mobile = within(screen.getByTestId('pipeline-records-mobile-view'));
		expect(mobile.getAllByTestId('pipeline-record-card')).toHaveLength(2);

		await user.type(mobile.getByPlaceholderText('common_search'), 'South');

		const cards = mobile.getAllByTestId('pipeline-record-card');
		expect(cards).toHaveLength(1);
		expect(within(cards[0]).getByText('Fiber South')).toBeInTheDocument();
	});
});
