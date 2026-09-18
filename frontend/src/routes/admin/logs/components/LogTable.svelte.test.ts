import type { LogFilters } from '$lib/remote/admin/logs-data';
import type { LogEntry } from '$lib/types';
import { error } from '@sveltejs/kit';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';

import LogTable from './LogTable.svelte';

const getLogs = vi.fn();

vi.mock('$lib/remote/admin/logs.remote', () => ({
	getLogs: (...args: unknown[]) => getLogs(...args)
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

const filters: LogFilters = {
	level: '',
	source: '',
	search: '',
	dateFrom: '',
	dateTo: '',
	project: '',
	page: 1
};

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
	return {
		uuid: 'log-1',
		timestamp: '2026-01-15T10:00:00Z',
		level: 'ERROR',
		logger_name: 'apps.api',
		message: 'Something failed',
		username: 'admin',
		user_email: null,
		source: 'backend',
		project: { id: 1, project: 'Project A' },
		...overrides
	} as LogEntry;
}

function renderTable(results: LogEntry[], count = results.length, page = 1) {
	getLogs.mockResolvedValue({ count, next: null, previous: null, results });
	const onPageChange = vi.fn();
	const view = render(BoundaryFixture, {
		props: {
			component: LogTable,
			props: { filters: { ...filters, page }, onPageChange }
		}
	});
	return { ...view, onPageChange };
}

beforeEach(() => {
	getLogs.mockReset();
});

describe('LogTable', () => {
	test('queries the logs with the given filters', async () => {
		renderTable([makeLog()]);

		await screen.findAllByText('Something failed');

		expect(getLogs).toHaveBeenCalledWith(filters);
	});

	test('renders level, source, project and user of each entry', async () => {
		renderTable([makeLog()]);

		// jsdom renders both the desktop table and the mobile cards.
		expect(await screen.findAllByText('ERROR')).toHaveLength(2);
		expect(screen.getAllByText('backend')).toHaveLength(2);
		expect(screen.getAllByText('Project A')).toHaveLength(2);
		expect(screen.getAllByText('admin')).toHaveLength(2);
	});

	test('shows the empty message when no logs match', async () => {
		renderTable([]);

		expect(await screen.findAllByText('message_no_logs_found')).toHaveLength(2);
	});

	test('shows no pagination for a single page', async () => {
		renderTable([makeLog()], 10);

		await screen.findAllByText('Something failed');

		expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
	});

	test('reports page changes to the parent', async () => {
		const user = userEvent.setup();
		const { onPageChange } = renderTable([makeLog()], 25);

		await screen.findAllByText('Something failed');
		await user.click(screen.getByRole('button', { name: 'next page' }));

		expect(onPageChange).toHaveBeenCalledWith(2);
	});

	test('surfaces a failed query to the boundary', async () => {
		getLogs.mockImplementation(() => {
			error(403, 'Admin access required');
		});

		render(BoundaryFixture, {
			props: { component: LogTable, props: { filters, onPageChange: vi.fn() } }
		});

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
