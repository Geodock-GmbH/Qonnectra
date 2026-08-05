import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { drawerStore } from '$lib/stores/drawer';
import { globalToaster } from '$lib/stores/toaster';

import PipeTable from './PipeTable.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

const gotoMock = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
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

const fetchMock = vi.fn();

function makePipe(overrides: Record<string, unknown> = {}) {
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

function mockRoutes(routes: Record<string, unknown> = {}) {
	fetchMock.mockImplementation((url: string) => {
		const payload = routes[url] ?? { type: 'success', data: {} };
		return Promise.resolve({
			ok: true,
			text: () => Promise.resolve(JSON.stringify(payload)),
			json: () => Promise.resolve(payload)
		});
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
	gotoMock.mockReset();
	drawerStore.close();
	vi.mocked(globalToaster.error).mockClear();
});

function desktopTable() {
	const view = screen.getByTestId('conduit-desktop-view');
	return within(view).getByRole('table');
}

describe('PipeTable', () => {
	test('should render a data row per pipe with its cell values', () => {
		mockRoutes();
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
		// Two data rows plus the empty-state placeholder must not be present.
		expect(within(table).queryByText('message_no_results_found')).not.toBeInTheDocument();
	});

	test('should render column headers from the config', () => {
		mockRoutes();
		render(PipeTable, { pipes: [makePipe()], pagination });

		const table = desktopTable();
		const headerRow = within(table).getAllByRole('row')[0];
		expect(within(headerRow).getByText('common_name')).toBeInTheDocument();
		expect(within(headerRow).getByText('form_conduit_type')).toBeInTheDocument();
		expect(within(headerRow).getByText('form_flag')).toBeInTheDocument();
	});

	test('should show the empty state when there are no pipes', () => {
		mockRoutes();
		render(PipeTable, { pipes: [], pagination: { totalCount: 0, pageSize: 25, page: 1 } });

		const table = desktopTable();
		expect(within(table).getByText('message_no_results_found')).toBeInTheDocument();
	});

	test('should filter rows via the per-column filter input', async () => {
		const user = userEvent.setup();
		mockRoutes();
		render(PipeTable, {
			pipes: [
				makePipe({ value: 'uuid-1', name: 'Rohr-A' }),
				makePipe({ value: 'uuid-2', name: 'Rohr-B' })
			],
			pagination
		});

		const table = desktopTable();
		const filterInput = within(table).getAllByPlaceholderText('common_search')[0];
		await user.type(filterInput, 'Rohr-B');

		expect(within(table).queryByText('Rohr-A')).not.toBeInTheDocument();
		expect(within(table).getByText('Rohr-B')).toBeInTheDocument();
	});

	test('should fetch the conduit and open the drawer when a row is clicked', async () => {
		const user = userEvent.setup();
		const conduit = { uuid: 'uuid-1', name: 'Rohr-A' };
		mockRoutes({ '?/getConduit': { type: 'success', data: { conduit } } });

		render(PipeTable, { pipes: [makePipe({ value: 'uuid-1', name: 'Rohr-A' })], pagination });

		const table = desktopTable();
		await user.click(within(table).getByText('Rohr-A'));

		await vi.waitFor(() => {
			const call = fetchMock.mock.calls.find(([url]) => url === '?/getConduit');
			expect(call).toBeTruthy();
			const body = call![1].body as FormData;
			expect(body.get('uuid')).toBe('uuid-1');
		});

		await vi.waitFor(() => {
			let opened = false;
			const unsub = drawerStore.subscribe((s) => {
				opened = s.open && s.title === 'Rohr-A';
			});
			unsub();
			expect(opened).toBe(true);
		});
	});

	test('should toast an error when the row fetch fails', async () => {
		const user = userEvent.setup();
		mockRoutes({ '?/getConduit': { type: 'failure', data: {} } });

		render(PipeTable, { pipes: [makePipe({ value: 'uuid-1', name: 'Rohr-A' })], pagination });

		const table = desktopTable();
		await user.click(within(table).getByText('Rohr-A'));

		await vi.waitFor(() => expect(globalToaster.error).toHaveBeenCalled());
	});

	test('should navigate to the requested page on pagination change', async () => {
		const user = userEvent.setup();
		mockRoutes();
		render(PipeTable, {
			pipes: [makePipe()],
			pagination: { totalCount: 100, pageSize: 10, page: 1 }
		});

		// Page "2" button lives inside the pagination control.
		const pageTwo = screen.getByText('2');
		await user.click(pageTwo);

		expect(gotoMock).toHaveBeenCalled();
		const target = gotoMock.mock.calls[0][0] as string;
		expect(target).toContain('page=2');
	});
});
