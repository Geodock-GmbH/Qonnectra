import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import FiberCell from './FiberCell.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

const fiber = {
	uuid: 'fiber-1',
	fiber_number: 12,
	bundle_number: 3,
	fiber_color: 'rot',
	cable_name: 'K-Nord',
	cable_uuid: 'cbl-1'
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('FiberCell', () => {
	test('should render fiber number, bundle, cable name and color swatch', () => {
		render(FiberCell, { props: { fiber, colorHex: '#ff0000', portNumber: 1, side: 'a' } });

		expect(screen.getByText('12')).toBeInTheDocument();
		expect(screen.getByText('B3')).toBeInTheDocument();
		expect(screen.getByText('K-Nord')).toBeInTheDocument();

		const swatch = document.querySelector('span[style*="background-color"]') as HTMLElement;
		expect(swatch).not.toBeNull();
		// jsdom normalises the hex to rgb().
		expect(swatch.style.backgroundColor).toBe('rgb(255, 0, 0)');
	});

	test('should render the drop hint for an empty port', () => {
		render(FiberCell, { props: { fiber: null, hasPort: true, portNumber: 2, side: 'a' } });

		expect(screen.getByText('message_drop_fiber_here')).toBeInTheDocument();
	});

	test('should render a dash placeholder when the port does not exist', () => {
		render(FiberCell, { props: { fiber: null, hasPort: false, portNumber: 3, side: 'b' } });

		expect(screen.getByText('-')).toBeInTheDocument();
		expect(screen.queryByText('message_drop_fiber_here')).not.toBeInTheDocument();
	});

	test('should render a residential unit with floor/side display name', () => {
		render(FiberCell, {
			props: {
				fiber: null,
				residentialUnit: {
					id_residential_unit: 'WE-5',
					floor: 2,
					side: 'links',
					resident_name: 'Mustermann'
				},
				hasPort: true,
				portNumber: 4,
				side: 'a'
			}
		});

		expect(screen.getByText('WE-5 (2. OG links)')).toBeInTheDocument();
		expect(screen.getByText('Mustermann')).toBeInTheDocument();
	});

	test('should prefer external_id over floor/side in the residential unit name', () => {
		render(FiberCell, {
			props: {
				fiber: null,
				residentialUnit: { id_residential_unit: 'WE-9', external_id_1: 'EXT-1', floor: 0 },
				hasPort: true,
				portNumber: 5,
				side: 'a'
			}
		});

		expect(screen.getByText('WE-9 (EXT-1)')).toBeInTheDocument();
	});

	test('should fire onClear when the clear button is clicked', async () => {
		const user = userEvent.setup();
		const onClear = vi.fn();
		render(FiberCell, { props: { fiber, colorHex: '#ff0000', portNumber: 1, side: 'a', onClear } });

		await user.click(screen.getByRole('button', { name: 'common_clear' }));

		expect(onClear).toHaveBeenCalledTimes(1);
	});

	test('should not render the clear button in readonly mode', () => {
		render(FiberCell, {
			props: { fiber, colorHex: '#ff0000', portNumber: 1, side: 'a', readonly: true }
		});

		expect(screen.queryByRole('button', { name: 'common_clear' })).not.toBeInTheDocument();
		// The trace button is intentionally still available in readonly mode.
		expect(screen.getByRole('button', { name: 'action_trace' })).toBeInTheDocument();
	});

	test('should render the port range and fire onUnmerge for a merged cell', async () => {
		const user = userEvent.setup();
		const onUnmerge = vi.fn();
		render(FiberCell, {
			props: {
				fiber: null,
				hasPort: true,
				portNumber: 1,
				side: 'a',
				spanRows: 3,
				portRange: '1-3',
				onUnmerge
			}
		});

		expect(screen.getByText('1-3')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'action_unmerge' }));
		expect(onUnmerge).toHaveBeenCalledTimes(1);
	});

	test('should fetch and render the trace summary when the trace button is clicked', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					start_node: { name: 'PoP-Nord' },
					end_node: { name: 'HÜP-5' },
					statistics: { total_splices: 4, total_addresses: 2, total_residential_units: 1 }
				})
		});
		vi.stubGlobal('fetch', fetchMock);

		render(FiberCell, { props: { fiber, colorHex: '#ff0000', portNumber: 1, side: 'a' } });

		await user.click(screen.getByRole('button', { name: 'action_trace' }));

		await vi.waitFor(() => expect(screen.getByText('PoP-Nord')).toBeInTheDocument());
		expect(screen.getByText('HÜP-5')).toBeInTheDocument();

		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toContain('fiber-trace/summary/?fiber_id=fiber-1');
		expect(options.credentials).toBe('include');
	});

	test('should render a trace error when the request fails', async () => {
		const user = userEvent.setup();
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

		render(FiberCell, { props: { fiber, colorHex: '#ff0000', portNumber: 1, side: 'a' } });

		await user.click(screen.getByRole('button', { name: 'action_trace' }));

		await vi.waitFor(() => expect(screen.getByText('trace_error')).toBeInTheDocument());
	});

	test('should parse dropped fiber data and fire onDrop', async () => {
		const onDrop = vi.fn();
		render(FiberCell, {
			props: { fiber: null, hasPort: true, portNumber: 2, side: 'a', onDrop }
		});

		const cell = document.querySelector('.fiber-cell') as HTMLElement;
		const payload = { type: 'fiber', uuid: 'dropped-fiber' };
		const dataTransfer = {
			getData: vi.fn(() => JSON.stringify(payload)),
			effectAllowed: 'move'
		};

		await fireEvent.drop(cell, { dataTransfer });

		expect(onDrop).toHaveBeenCalledWith(payload);
	});

	test('should ignore drops when the port does not exist', async () => {
		const onDrop = vi.fn();
		render(FiberCell, {
			props: { fiber: null, hasPort: false, portNumber: 3, side: 'b', onDrop }
		});

		const cell = document.querySelector('.fiber-cell') as HTMLElement;
		const dataTransfer = {
			getData: vi.fn(() => JSON.stringify({ type: 'fiber', uuid: 'x' })),
			effectAllowed: 'move'
		};

		await fireEvent.drop(cell, { dataTransfer });

		expect(onDrop).not.toHaveBeenCalled();
	});
});
