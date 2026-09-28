import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import { flushSync } from 'svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { simulateFault } from '$lib/remote/fault-simulation/simulation.remote';

import FaultSimulationPopUpFixture from './FaultSimulationPopUp.fixture.svelte';
import { FaultSimulationState } from './FaultSimulationState.svelte';

const { pageState } = vi.hoisted(() => ({
	pageState: {
		url: new URL('http://localhost/project/7/fault-simulation?damage=100,200'),
		params: { projectId: '7' }
	}
}));

vi.mock('$app/state', () => ({ page: pageState }));
const { gotoMock } = vi.hoisted(() => ({ gotoMock: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

vi.mock('$lib/remote/fault-simulation/simulation.remote', () => ({
	simulateFault: vi.fn()
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const trench = { id_trench: 'T-001', construction_type: 'Offene Bauweise', uuid: 'trench-1' };

const result: FaultSimulationResult = {
	trench,
	conduits: [],
	cables: [],
	affected_addresses_details: []
};

function renderPopUp() {
	const simulation = new FaultSimulationState();
	render(FaultSimulationPopUpFixture, { props: { simulation } });
	return simulation;
}

beforeEach(() => {
	pageState.url = new URL('http://localhost/project/7/fault-simulation?damage=100,200');
	gotoMock.mockReset();
	vi.mocked(simulateFault).mockReset();
});

describe('FaultSimulationPopUp', () => {
	test('should render nothing without a damage location in the URL', () => {
		pageState.url = new URL('http://localhost/project/7/fault-simulation');
		renderPopUp();

		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	test('should show that the simulation of the URL location is running', () => {
		vi.mocked(simulateFault).mockReturnValue({ current: undefined, loading: true } as never);
		renderPopUp();

		expect(screen.getByRole('status')).toHaveTextContent('action_start_simulation');
		expect(simulateFault).toHaveBeenCalledWith({ point: [100, 200], projectId: '7' });
	});

	test('should show the trench the simulation found', () => {
		vi.mocked(simulateFault).mockReturnValue({ current: result, loading: false } as never);
		renderPopUp();

		expect(screen.getByText('T-001')).toBeInTheDocument();
		expect(screen.getByText('Offene Bauweise')).toBeInTheDocument();
	});

	describe('with a location picked on the map', () => {
		beforeEach(() => {
			pageState.url = new URL('http://localhost/project/7/fault-simulation');
		});

		test('should show the picked trench without simulating it', () => {
			const simulation = renderPopUp();
			simulation.picked = { point: [100.4, 200.6], trench };
			flushSync();

			expect(screen.getByText('T-001')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: 'action_start_simulation' })).toBeInTheDocument();
			expect(simulateFault).not.toHaveBeenCalled();
			expect(gotoMock).not.toHaveBeenCalled();
		});

		test('should name the picked location in the URL when the simulation is started', async () => {
			const simulation = renderPopUp();
			simulation.picked = { point: [100.4, 200.6], trench };
			flushSync();

			await fireEvent.click(screen.getByRole('button', { name: 'action_start_simulation' }));

			expect(gotoMock).toHaveBeenCalledWith('/project/7/fault-simulation?damage=100%2C201', {
				keepFocus: true,
				noScroll: true,
				replaceState: false
			});
			await vi.waitFor(() => expect(simulation.picked).toBeNull());
		});
	});
});
