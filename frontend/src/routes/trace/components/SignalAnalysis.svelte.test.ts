import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import SignalAnalysis from './SignalAnalysis.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/trace/node/n1?mode=signal'), data: { srid: 25832 } }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const breakPoint = {
	fiber_id: 'fiber-1',
	fiber_number_absolute: 3,
	cable_id: 'cable-1',
	cable_name: 'K-Nord',
	at_node: { id: 'node-1', name: 'Muffe Süd' },
	status: 'defekt'
};

const baseResult = {
	signal_analysis: {
		source_node: { id: 'node-src', name: 'PoP-1' },
		total_breaks: 0,
		break_points: [],
		available_sources: [{ id: 'node-src', name: 'PoP-1', direction: 'start', is_default: true }]
	},
	affected_summary: {
		lit_fibers: 5,
		dark_fibers: 2,
		lit_nodes: 3,
		dark_nodes: 1,
		affected_addresses: 4,
		affected_residential_units: 7
	},
	trace_tree: {
		fiber: { id: 'fiber-1', cable_id: 'cable-1', fiber_number_absolute: 3, cable_name: 'K-Nord' },
		signal_state: 'dark',
		children: []
	},
	statistics: {},
	cable_infrastructure: { 'cable-1': { total_length: 120.5 } }
};

describe('SignalAnalysis', () => {
	test('should show a success banner when there are no breaks', () => {
		render(SignalAnalysis, { result: baseResult, entryId: 'entry-1' });

		expect(screen.getByText('signal_no_breaks')).toBeInTheDocument();
	});

	test('should render break point cards and forward item clicks', async () => {
		const user = userEvent.setup();
		const onItemSelect = vi.fn();
		const result = {
			...baseResult,
			signal_analysis: {
				...baseResult.signal_analysis,
				total_breaks: 1,
				break_points: [breakPoint]
			}
		};

		render(SignalAnalysis, { result, entryId: 'entry-1', onItemSelect });

		expect(screen.getAllByText('F3').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('K-Nord').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText('Muffe Süd')).toBeInTheDocument();

		await user.click(screen.getAllByText('F3')[0]);
		expect(onItemSelect).toHaveBeenCalledWith('fiber', 'fiber-1');

		await user.click(screen.getByText('Muffe Süd'));
		expect(onItemSelect).toHaveBeenCalledWith('node', 'node-1');
	});

	test('should render the affected summary with lit and dark counts', () => {
		render(SignalAnalysis, { result: baseResult, entryId: 'entry-1' });

		expect(screen.getByText('signal_affected_summary')).toBeInTheDocument();
		expect(screen.getByText('5')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByText('4')).toBeInTheDocument();
		expect(screen.getByText('7')).toBeInTheDocument();
	});

	test('should compute the signal reach length from the cable infrastructure', () => {
		render(SignalAnalysis, { result: baseResult, entryId: 'entry-1' });

		// The only cable is dark, so the whole length counts as dark
		expect(screen.getByText('120.5m')).toBeInTheDocument();
		expect(screen.getByText('0.0m')).toBeInTheDocument();
	});

	test('should render the signal flow tree', () => {
		render(SignalAnalysis, { result: baseResult, entryId: 'entry-1' });

		expect(screen.getByText('signal_analysis')).toBeInTheDocument();
	});
});
