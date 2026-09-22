import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { simulateFault } from '$lib/remote/fault-simulation/simulation.remote';
import { httpError } from '$lib/test-utils/remote-stubs';

import FaultSimulationPopUpFixture from './FaultSimulationPopUp.fixture.svelte';
import { FaultSimulationState } from './FaultSimulationState.svelte';

vi.mock('$lib/remote/fault-simulation/simulation.remote', () => ({
	simulateFault: vi.fn()
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: { error: vi.fn() }
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn(() => Promise.resolve())
}));

const trench = { id_trench: 'T-001', construction_type: 'Offene Bauweise', uuid: 'trench-1' };

const result: FaultSimulationResult = {
	trench,
	conduits: [],
	cables: [],
	affected_addresses_details: []
};

function renderPopUp(projectId = '7') {
	const simulation = new FaultSimulationState();
	simulation.selectDamagePoint([100, 200], [10, 20], trench);
	render(FaultSimulationPopUpFixture, { props: { simulation, projectId } });
	return simulation;
}

afterEach(() => {
	vi.mocked(simulateFault).mockReset();
	vi.mocked(globalToaster.error).mockClear();
});

describe('FaultSimulationPopUp', () => {
	test('should render nothing without a damage point', () => {
		render(FaultSimulationPopUpFixture, {
			props: { simulation: new FaultSimulationState(), projectId: '7' }
		});

		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	test('should show the selected trench', () => {
		renderPopUp();

		expect(screen.getByText('T-001')).toBeInTheDocument();
		expect(screen.getByText('Offene Bauweise')).toBeInTheDocument();
	});

	test('should simulate the damage point and publish the result', async () => {
		vi.mocked(simulateFault).mockResolvedValue(result as never);
		const simulation = renderPopUp();

		await userEvent.click(screen.getByRole('button'));

		expect(simulateFault).toHaveBeenCalledWith({ point: [100, 200], projectId: '7' });
		expect(simulation.simulationResult).toEqual(result);
		expect(simulation.isSimulating).toBe(false);
	});

	test('should disable the button while the simulation runs', async () => {
		let finish: (value: FaultSimulationResult) => void = () => {};
		vi.mocked(simulateFault).mockReturnValue(
			new Promise<FaultSimulationResult>((resolve) => (finish = resolve)) as never
		);
		const simulation = renderPopUp();

		await userEvent.click(screen.getByRole('button'));

		expect(screen.getByRole('button')).toBeDisabled();
		expect(simulation.canSelectDamagePoint).toBe(false);

		finish(result);
		await vi.waitFor(() => expect(simulation.isSimulating).toBe(false));
	});

	test('should toast the backend message and stay retryable when the simulation fails', async () => {
		vi.mocked(simulateFault).mockRejectedValue(
			httpError(404, 'No trench found near the point') as never
		);
		const simulation = renderPopUp();

		await userEvent.click(screen.getByRole('button'));

		expect(globalToaster.error).toHaveBeenCalledWith(
			expect.objectContaining({ description: 'No trench found near the point' })
		);
		expect(simulation.simulationResult).toBeNull();
		expect(screen.getByRole('button')).toBeEnabled();
	});

	test('should not simulate without a project', async () => {
		renderPopUp('');

		await userEvent.click(screen.getByRole('button'));

		expect(simulateFault).not.toHaveBeenCalled();
	});
});
