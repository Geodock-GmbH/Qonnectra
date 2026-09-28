import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { simulateFault } from '$lib/remote/fault-simulation/simulation.remote';

import { FaultSimulationState } from './FaultSimulationState.svelte';

const { pageState, gotoMock } = vi.hoisted(() => ({
	pageState: {
		url: new URL('http://localhost/project/7/fault-simulation'),
		params: { projectId: '7' }
	},
	gotoMock: vi.fn()
}));

vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

vi.mock('$lib/remote/fault-simulation/simulation.remote', () => ({
	simulateFault: vi.fn()
}));

const trench = { id_trench: 'T-001', construction_type: 'open', uuid: 'trench-uuid' };

const result: FaultSimulationResult = {
	trench,
	conduits: [],
	cables: [],
	affected_addresses_details: []
};

/** A remote query stand-in in a given phase. */
function queryOf(current: FaultSimulationResult | undefined, loading = false) {
	return { current, loading, error: undefined };
}

describe('FaultSimulationState', () => {
	let simulation: FaultSimulationState;

	beforeEach(() => {
		pageState.url = new URL('http://localhost/project/7/fault-simulation');
		gotoMock.mockReset();
		vi.mocked(simulateFault).mockReset();
		simulation = new FaultSimulationState();
	});

	test('should start without a damage point, result or running simulation', () => {
		expect(simulation.damagePoint).toBeNull();
		expect(simulation.selectedTrench).toBeNull();
		expect(simulation.simulationResult).toBeNull();
		expect(simulation.isSimulating).toBe(false);
		expect(simulation.canSelectDamagePoint).toBe(true);
		expect(simulateFault).not.toHaveBeenCalled();
	});

	test('should not simulate or navigate while a picked location is unconfirmed', () => {
		simulation.picked = { point: [563210.4, 5934120.6], trench };

		expect(simulation.damagePoint).toBeNull();
		expect(simulation.canSelectDamagePoint).toBe(true);
		expect(simulateFault).not.toHaveBeenCalled();
		expect(gotoMock).not.toHaveBeenCalled();
	});

	test('should start the simulation by naming the picked location in the URL as a place', async () => {
		simulation.picked = { point: [563210.4, 5934120.6], trench };

		await simulation.startSimulation();

		expect(gotoMock).toHaveBeenCalledWith('/project/7/fault-simulation?damage=563210%2C5934121', {
			keepFocus: true,
			noScroll: true,
			replaceState: false
		});
		expect(simulation.picked).toBeNull();
	});

	test('should not navigate when starting without a picked location', async () => {
		await simulation.startSimulation();

		expect(gotoMock).not.toHaveBeenCalled();
	});

	test('should drop the picked location on reset', async () => {
		simulation.picked = { point: [563210, 5934120], trench };

		await simulation.reset();

		expect(simulation.picked).toBeNull();
		expect(gotoMock).not.toHaveBeenCalled();
	});

	describe('with a damage location in the URL', () => {
		beforeEach(() => {
			pageState.url = new URL('http://localhost/project/7/fault-simulation?damage=563210,5934120');
		});

		test('should simulate that location in the project from the URL', () => {
			vi.mocked(simulateFault).mockReturnValue(queryOf(undefined, true) as never);

			expect(simulation.damagePoint).toEqual([563210, 5934120]);
			expect(simulation.isSimulating).toBe(true);
			expect(simulation.simulationResult).toBeNull();
			expect(simulation.canSelectDamagePoint).toBe(false);
			expect(simulateFault).toHaveBeenCalledWith({ point: [563210, 5934120], projectId: '7' });
		});

		test('should expose the finished simulation and its trench', () => {
			vi.mocked(simulateFault).mockReturnValue(queryOf(result) as never);

			expect(simulation.simulationResult).toEqual(result);
			expect(simulation.selectedTrench).toEqual(trench);
			expect(simulation.isSimulating).toBe(false);
		});

		test('should clear the overlay and remove the damage from the URL on reset', async () => {
			vi.mocked(simulateFault).mockReturnValue(queryOf(result) as never);
			simulation.overlay.showDamagePoint([10, 20]);

			await simulation.reset();

			expect(simulation.overlay.damagePointSource.getFeatures()).toHaveLength(0);
			expect(gotoMock).toHaveBeenCalledWith('/project/7/fault-simulation', {
				keepFocus: true,
				noScroll: true,
				replaceState: true
			});
		});
	});

	test('should ignore a malformed damage value', () => {
		pageState.url = new URL('http://localhost/project/7/fault-simulation?damage=abc');

		expect(simulation.damagePoint).toBeNull();
		expect(simulation.simulationResult).toBeNull();
		expect(simulateFault).not.toHaveBeenCalled();
	});

	describe('injected result (dev-only e2e hook)', () => {
		test('should show the injected result and draw it on the overlay', () => {
			simulation.showResult(result);

			expect(simulation.simulationResult).toEqual(result);
			expect(simulation.selectedTrench).toEqual(trench);
			expect(simulation.canSelectDamagePoint).toBe(false);
		});

		test('should drop the injected result on reset without navigating', async () => {
			simulation.showResult(result);

			await simulation.reset();

			expect(simulation.simulationResult).toBeNull();
			expect(gotoMock).not.toHaveBeenCalled();
		});
	});
});
