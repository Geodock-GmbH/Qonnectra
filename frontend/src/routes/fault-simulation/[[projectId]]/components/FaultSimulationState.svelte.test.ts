import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import { beforeEach, describe, expect, test } from 'vitest';

import { FaultSimulationState } from './FaultSimulationState.svelte';

const trench = { id_trench: 'T-001', construction_type: 'open', uuid: 'trench-uuid' };

const result: FaultSimulationResult = {
	trench,
	conduits: [],
	cables: [],
	affected_addresses_details: []
};

describe('FaultSimulationState', () => {
	let simulation: FaultSimulationState;

	beforeEach(() => {
		simulation = new FaultSimulationState();
	});

	test('should start without a damage point, result or running simulation', () => {
		expect(simulation.damagePoint).toBeNull();
		expect(simulation.damageMapCoordinate).toBeNull();
		expect(simulation.selectedTrench).toBeNull();
		expect(simulation.simulationResult).toBeNull();
		expect(simulation.isSimulating).toBe(false);
		expect(simulation.canSelectDamagePoint).toBe(true);
	});

	describe('selectDamagePoint', () => {
		test('should store the location in both projections and the trench', () => {
			simulation.selectDamagePoint([100, 200], [10, 20], trench);

			expect(simulation.damagePoint).toEqual([100, 200]);
			expect(simulation.damageMapCoordinate).toEqual([10, 20]);
			expect(simulation.selectedTrench).toEqual(trench);
		});

		test('should mark the damage location on the map overlay', () => {
			simulation.selectDamagePoint([100, 200], [10, 20], trench);

			const [marker] = simulation.overlay.damagePointSource.getFeatures();
			expect(marker.getGeometry()?.getExtent()).toEqual([10, 20, 10, 20]);
		});

		test('should replace the previous marker instead of adding a second one', () => {
			simulation.selectDamagePoint([100, 200], [10, 20], trench);
			simulation.selectDamagePoint([300, 400], [30, 40], trench);

			expect(simulation.overlay.damagePointSource.getFeatures()).toHaveLength(1);
		});

		test('should discard a prior simulation result', () => {
			simulation.showResult(result);

			simulation.selectDamagePoint([100, 200], [10, 20], trench);

			expect(simulation.simulationResult).toBeNull();
		});
	});

	describe('canSelectDamagePoint', () => {
		test('should be false while a simulation is running', () => {
			simulation.isSimulating = true;

			expect(simulation.canSelectDamagePoint).toBe(false);
		});

		test('should be false while a result is shown', () => {
			simulation.showResult(result);

			expect(simulation.canSelectDamagePoint).toBe(false);
		});
	});

	describe('showResult', () => {
		test('should store the result and keep the damage point', () => {
			simulation.selectDamagePoint([100, 200], [10, 20], trench);

			simulation.showResult(result);

			expect(simulation.simulationResult).toEqual(result);
			expect(simulation.damagePoint).toEqual([100, 200]);
		});
	});

	describe('reset', () => {
		test('should return to the initial state and clear the overlay', () => {
			simulation.selectDamagePoint([100, 200], [10, 20], trench);
			simulation.isSimulating = true;
			simulation.showResult(result);

			simulation.reset();

			expect(simulation.damagePoint).toBeNull();
			expect(simulation.damageMapCoordinate).toBeNull();
			expect(simulation.selectedTrench).toBeNull();
			expect(simulation.simulationResult).toBeNull();
			expect(simulation.isSimulating).toBe(false);
			expect(simulation.overlay.damagePointSource.getFeatures()).toHaveLength(0);
		});
	});
});
