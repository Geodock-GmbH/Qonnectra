import type { ComponentProps } from 'svelte';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';

import TrenchTable from './TrenchTable.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$app/forms', () => ({
	deserialize: vi.fn((text: string) => JSON.parse(text))
}));

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
		error: vi.fn(),
		warning: vi.fn(),
		promise: vi.fn()
	}
}));

const fetchMock = vi.fn();

/**
 * Configures fetch to return a mapped payload per SvelteKit action URL.
 */
function mockRoutes(routes: Record<string, unknown> = {}) {
	fetchMock.mockImplementation((url: string) => {
		const payload = routes[url] ?? { type: 'success', data: {} };
		return Promise.resolve({
			ok: true,
			text: () => Promise.resolve(JSON.stringify(payload))
		});
	});
}

function trenchRows() {
	return {
		'?/getTrenchConnections': {
			type: 'success',
			data: {
				trenches: [
					{ value: 'conn-a', label: 'Trench Alpha', trench: 'trench-a' },
					{ value: 'conn-b', label: 'Trench Beta', trench: 'trench-b' }
				]
			}
		}
	};
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockReset();
});

describe('TrenchTable', () => {
	test('renders a row per trench with its label from fetched data', async () => {
		mockRoutes(trenchRows());

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);

		expect(await screen.findByText('Trench Alpha')).toBeInTheDocument();
		expect(screen.getByText('Trench Beta')).toBeInTheDocument();
		expect(screen.getByText(/^2 /)).toBeInTheDocument();
	});

	test('shows the empty state when no trenches are returned', async () => {
		mockRoutes({ '?/getTrenchConnections': { type: 'success', data: { trenches: [] } } });

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);

		expect(await screen.findByText('message_no_trenches')).toBeInTheDocument();
		expect(screen.queryByRole('table')).not.toBeInTheDocument();
	});

	test('renders the sortable trench-id header', async () => {
		mockRoutes(trenchRows());

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);

		await screen.findByText('Trench Alpha');
		expect(screen.getByRole('button', { name: /form_trench_id/ })).toBeInTheDocument();
	});

	test('filters rows by label via the search input', async () => {
		mockRoutes(trenchRows());
		const user = userEvent.setup();

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);
		await screen.findByText('Trench Alpha');

		await user.type(screen.getByPlaceholderText('common_search'), 'beta');

		expect(screen.queryByText('Trench Alpha')).not.toBeInTheDocument();
		expect(screen.getByText('Trench Beta')).toBeInTheDocument();
	});

	test('shows the no-results state for a non-matching filter', async () => {
		mockRoutes(trenchRows());
		const user = userEvent.setup();

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);
		await screen.findByText('Trench Alpha');

		await user.type(screen.getByPlaceholderText('common_search'), 'zzz-unknown');

		expect(screen.getByText('common_no_results')).toBeInTheDocument();
		expect(screen.queryByText('Trench Alpha')).not.toBeInTheDocument();
	});

	test('toggles sort order when the header is clicked', async () => {
		mockRoutes(trenchRows());
		const user = userEvent.setup();

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);
		await screen.findByText('Trench Alpha');

		const orderBefore = screen.getAllByRole('cell').map((c) => c.textContent?.trim());
		expect(orderBefore[0]).toBe('Trench Alpha');

		await user.click(screen.getByRole('button', { name: /form_trench_id/ }));

		const orderAfter = screen
			.getAllByRole('cell')
			.map((c) => c.textContent?.trim())
			.filter((t) => t?.startsWith('Trench'));
		expect(orderAfter[0]).toBe('Trench Beta');
		expect(orderAfter[1]).toBe('Trench Alpha');
	});

	test('invokes onTrenchClick with the trench id and label on row click', async () => {
		mockRoutes(trenchRows());
		const onTrenchClick = vi.fn();
		const user = userEvent.setup();

		render(TrenchTable, {
			conduitId: 'conduit-1',
			onTrenchClick
		} as unknown as ComponentProps<typeof TrenchTable>);
		const cell = await screen.findByText('Trench Alpha');

		await user.click(cell);

		expect(onTrenchClick).toHaveBeenCalledWith('trench-a', 'Trench Alpha');
	});

	test('deletes a connection and refetches when the trash button is clicked', async () => {
		mockRoutes(trenchRows());
		const user = userEvent.setup();

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);
		const row = (await screen.findByText('Trench Alpha')).closest('tr') as HTMLTableRowElement;

		fetchMock.mockClear();
		await user.click(within(row).getByRole('button'));

		await vi.waitFor(() => {
			const deleteCall = fetchMock.mock.calls.find(([url]) => url === '?/deleteTrenchConnection');
			expect(deleteCall).toBeTruthy();
			const body = deleteCall![1].body as FormData;
			expect(body.get('connectionId')).toBe('conn-a');
		});
		expect(globalToaster.promise).toHaveBeenCalled();
	});

	test('notifies onTrenchesChange after a successful fetch', async () => {
		mockRoutes(trenchRows());
		const onTrenchesChange = vi.fn();

		render(TrenchTable, {
			conduitId: 'conduit-1',
			onTrenchesChange
		} as unknown as ComponentProps<typeof TrenchTable>);

		await vi.waitFor(() =>
			expect(onTrenchesChange).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ label: 'Trench Alpha' })])
			)
		);
	});

	test('shows the error state when the fetch action fails', async () => {
		mockRoutes({
			'?/getTrenchConnections': { type: 'failure', data: { error: 'boom' } }
		});

		render(TrenchTable, {
			conduitId: 'conduit-1'
		} as unknown as ComponentProps<typeof TrenchTable>);

		expect(await screen.findByText('message_error_fetching_trenches')).toBeInTheDocument();
	});
});
