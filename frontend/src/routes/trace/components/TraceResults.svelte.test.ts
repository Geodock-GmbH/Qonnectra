import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import TraceResults from './TraceResults.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/trace/node/n1'), data: { srid: 25832 } }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const statistics = {
	total_fibers: 12,
	total_nodes: 5,
	total_splices: 3,
	total_cables: 2,
	total_trenches: 8,
	total_addresses: 4,
	total_residential_units: 6,
	has_branches: true
};

const traceTree = {
	fiber: {
		id: 'fiber-1',
		cable_id: 'cable-1',
		cable_name: 'K-Nord',
		fiber_number_absolute: 3
	},
	children: [
		{
			fiber: {
				id: 'fiber-2',
				cable_id: 'cable-2',
				cable_name: 'K-Süd',
				fiber_number_absolute: 7
			},
			children: []
		}
	]
};

const baseResult = {
	statistics,
	entry_point: { type: 'node', id: 'node-1', name: 'PoP-1' },
	trace_tree: traceTree,
	cable_infrastructure: {}
};

describe('TraceResults', () => {
	test('should render nothing without a result', () => {
		const { container } = render(TraceResults, {
			result: null as never,
			entryType: 'node',
			entryId: 'node-1'
		});

		expect(container.textContent).toBe('');
	});

	test('should not render the statistics cards', () => {
		render(TraceResults, { result: baseResult, entryType: 'node', entryId: 'node-1' });

		expect(screen.queryByText('trace_statistics')).not.toBeInTheDocument();
	});

	test('should show the entry point with its type label and name', () => {
		render(TraceResults, { result: baseResult, entryType: 'node', entryId: 'node-1' });

		expect(screen.getByText('trace_entry_point')).toBeInTheDocument();
		expect(screen.getByText('form_node')).toBeInTheDocument();
		expect(screen.getByText('PoP-1')).toBeInTheDocument();
	});

	test('should render the trace tree with parent and child fibers', () => {
		render(TraceResults, { result: baseResult, entryType: 'node', entryId: 'node-1' });

		expect(screen.getByText('F3')).toBeInTheDocument();
		expect(screen.getByText('F7')).toBeInTheDocument();
		expect(screen.getByText('K-Nord')).toBeInTheDocument();
		expect(screen.getByText('K-Süd')).toBeInTheDocument();
	});

	test('should forward clicks on tree items to onItemSelect', async () => {
		const user = userEvent.setup();
		const onItemSelect = vi.fn();
		render(TraceResults, {
			result: baseResult,
			entryType: 'node',
			entryId: 'node-1',
			onItemSelect
		});

		await user.click(screen.getByText('F3'));

		expect(onItemSelect).toHaveBeenCalledWith('fiber', 'fiber-1');
	});

	test('should not offer an end to read from unless the trace names one', () => {
		render(TraceResults, { result: baseResult, entryType: 'node', entryId: 'node-1' });

		expect(screen.queryByText('trace_path_start')).not.toBeInTheDocument();
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
	});

	test('should mark the traced fiber inside the path read from its end', () => {
		const result = {
			...baseResult,
			entry_point: { type: 'fiber', id: 'fiber-2', name: 'F7 in K-Süd' },
			start: {
				node: { id: 'node-pop', name: 'PoP-1', type: 'POP', direction: 'start', is_default: true },
				available_nodes: [
					{ id: 'node-pop', name: 'PoP-1', type: 'POP', direction: 'start', is_default: true },
					{ id: 'node-house', name: 'Haus 5', direction: 'end', is_default: false }
				]
			}
		};

		render(TraceResults, { result, entryType: 'fiber', entryId: 'fiber-2' });

		expect(screen.getByText('trace_path_start')).toBeInTheDocument();
		expect(screen.getByRole('combobox')).toHaveValue(
			'PoP-1 (signal_source_cable_start) (common_default)'
		);
		expect(screen.getByText('POP')).toBeInTheDocument();
		const [, entryBadge] = screen.getAllByText('trace_entry_point');
		expect(entryBadge.closest('div')).toHaveTextContent('F7');
		expect(entryBadge.closest('div')).not.toHaveTextContent('F3');
	});

	test('should read the path from the picked end through the URL', async () => {
		const user = userEvent.setup();
		const { goto } = await import('$app/navigation');
		const result = {
			...baseResult,
			entry_point: { type: 'fiber', id: 'fiber-1', name: 'F3 in K-Nord' },
			start: {
				node: { id: 'node-pop', name: 'PoP-1', direction: 'start', is_default: true },
				available_nodes: [
					{ id: 'node-pop', name: 'PoP-1', direction: 'start', is_default: true },
					{ id: 'node-house', name: 'Haus 5', direction: 'end', is_default: false }
				]
			}
		};

		render(TraceResults, { result, entryType: 'fiber', entryId: 'fiber-1' });

		await user.clear(screen.getByRole('combobox'));
		await user.click(await screen.findByRole('option', { name: /Haus 5/ }));

		expect(goto).toHaveBeenCalledWith(
			'/trace/node/n1?start=node-house',
			expect.objectContaining({ replaceState: false })
		);
	});

	test('should show the empty tree hint without trace data', () => {
		render(TraceResults, {
			result: { ...baseResult, trace_tree: null },
			entryType: 'node',
			entryId: 'node-1'
		});

		expect(screen.getByText('trace_no_trace_data')).toBeInTheDocument();
	});
});
