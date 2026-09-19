import type { TraceRequest } from './traceOptions';
import { error } from '@sveltejs/kit';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { getFiberTrace, getSignalAnalysis } from '$lib/remote/trace/trace.remote';

import TraceOutcomeFixture from './TraceOutcome.fixture.svelte';
import { TraceSelection } from './TraceSelection.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/trace/fiber/fiber-1'), data: { srid: 25832 } }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const traceOptions = {
	mode: 'trace',
	includeGeometry: true,
	geometryMode: 'merged',
	orientGeometry: false,
	signalSource: null
} as const;

const traceResult = {
	statistics: { total_fibers: 42 },
	trace_tree: {
		fiber: { id: 'fiber-1', cable_id: 'cable-1', cable_name: 'K-Nord', fiber_number_absolute: 3 },
		children: []
	}
};

const signalResult = {
	signal_analysis: {
		source_node: { id: 'node-src', name: 'PoP-1' },
		total_breaks: 0,
		break_points: [],
		available_sources: []
	},
	affected_summary: { lit_fibers: 5, dark_fibers: 2 },
	statistics: {},
	cable_infrastructure: {}
};

/**
 * Builds a Kit HttpError the way a remote function's `error()` call does.
 */
function httpError(status: number, message: string): unknown {
	try {
		error(status, message);
	} catch (e) {
		return e;
	}
	return null;
}

function renderOutcome(request: TraceRequest) {
	const selection = new TraceSelection();
	render(TraceOutcomeFixture, { props: { request, selection } });
	return selection;
}

afterEach(() => {
	vi.mocked(getFiberTrace).mockReset();
	vi.mocked(getSignalAnalysis).mockReset();
});

describe('TraceOutcome', () => {
	test('should trace the requested entity with the page’s geometry options', async () => {
		vi.mocked(getFiberTrace).mockResolvedValue(traceResult);

		renderOutcome({ entryType: 'cable', entryId: 'cable-1', options: traceOptions });

		expect(await screen.findByText('trace_entry_point')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'K-Nord' })).toBeInTheDocument();
		expect(getFiberTrace).toHaveBeenCalledWith({
			entryType: 'cable',
			entryId: 'cable-1',
			includeGeometry: true,
			geometryMode: 'merged',
			orientGeometry: false
		});
		expect(getSignalAnalysis).not.toHaveBeenCalled();
	});

	test('should run the signal analysis from the picked source in signal mode', async () => {
		vi.mocked(getSignalAnalysis).mockResolvedValue(signalResult);

		renderOutcome({
			entryType: 'fiber',
			entryId: 'fiber-1',
			options: {
				mode: 'signal',
				includeGeometry: true,
				geometryMode: 'routed',
				orientGeometry: true,
				signalSource: 'node-src'
			}
		});

		expect(await screen.findByText('signal_no_breaks')).toBeInTheDocument();
		expect(getSignalAnalysis).toHaveBeenCalledWith({
			fiberId: 'fiber-1',
			signalSource: 'node-src',
			orientGeometry: true
		});
		expect(getFiberTrace).not.toHaveBeenCalled();
	});

	test('should highlight a clicked cable for the map', async () => {
		const user = userEvent.setup();
		vi.mocked(getFiberTrace).mockResolvedValue(traceResult);
		const selection = renderOutcome({
			entryType: 'fiber',
			entryId: 'fiber-1',
			options: traceOptions
		});

		await user.click(await screen.findByRole('button', { name: 'K-Nord' }));

		expect(selection.featureId).toBe('cable:cable-1');
	});

	test('should not highlight anything on a trace that has no map', async () => {
		const user = userEvent.setup();
		vi.mocked(getFiberTrace).mockResolvedValue(traceResult);
		const selection = renderOutcome({
			entryType: 'cable',
			entryId: 'cable-1',
			options: traceOptions
		});

		await user.click(await screen.findByRole('button', { name: 'K-Nord' }));

		expect(selection.featureId).toBeNull();
	});

	test('should show the backend’s reason when the trace fails', async () => {
		vi.mocked(getFiberTrace).mockRejectedValue(httpError(400, 'Invalid UUID format'));

		renderOutcome({ entryType: 'node', entryId: 'nope', options: traceOptions });

		expect(await screen.findByRole('alert')).toHaveTextContent('Invalid UUID format');
	});
});
