import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import FiberPathsTable from './FiberPathsTable.svelte';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

function makeTree(fiberNumber: number, cableName: string, destination: string) {
	return {
		fiber: {
			id: `fiber-${fiberNumber}`,
			cable_id: 'cable-1',
			cable_name: cableName,
			fiber_number_absolute: fiberNumber,
			fiber_color: 'rot',
			fiber_color_hex: '#ff0000',
			bundle_color: 'blau',
			bundle_color_hex: '#0000ff'
		},
		node: { id: 'node-dest', name: destination },
		residential_units: [{ uuid: 'ru-1' }, { uuid: 'ru-2' }],
		children: []
	};
}

describe('FiberPathsTable', () => {
	test('should render a row per fiber path with cable and destination', () => {
		render(FiberPathsTable, {
			traceTrees: [makeTree(1, 'K-Nord', 'PoP-Nord'), makeTree(2, 'K-Süd', 'PoP-Süd')]
		});

		expect(screen.getAllByText('F1').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('F2').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('K-Nord').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('K-Süd').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('PoP-Nord').length).toBeGreaterThanOrEqual(1);
	});

	test('should filter rows by fiber number, cable, or destination', async () => {
		const user = userEvent.setup();
		render(FiberPathsTable, {
			traceTrees: [makeTree(1, 'K-Nord', 'PoP-Nord'), makeTree(2, 'K-Süd', 'PoP-Süd')]
		});

		const searchInput = screen.getByPlaceholderText('trace_filter_placeholder');
		await user.type(searchInput, 'K-Süd');

		expect(screen.queryAllByText('F1')).toHaveLength(0);
		expect(screen.getAllByText('F2').length).toBeGreaterThanOrEqual(1);

		await user.clear(searchInput);
		await user.type(searchInput, 'PoP-Nord');
		expect(screen.getAllByText('F1').length).toBeGreaterThanOrEqual(1);
		expect(screen.queryAllByText('F2')).toHaveLength(0);
	});

	test('should render nothing matching for an unknown query', async () => {
		const user = userEvent.setup();
		render(FiberPathsTable, { traceTrees: [makeTree(1, 'K-Nord', 'PoP-Nord')] });

		await user.type(screen.getByPlaceholderText('trace_filter_placeholder'), 'xyz-unbekannt');

		expect(screen.queryAllByText('F1')).toHaveLength(0);
	});
});
