import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import { render, screen } from '@testing-library/svelte';
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
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

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
});
