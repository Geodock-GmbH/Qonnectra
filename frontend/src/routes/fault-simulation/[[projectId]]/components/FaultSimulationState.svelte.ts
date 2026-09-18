import type { FaultSimulationResult, Trench } from '$lib/remote/fault-simulation/simulation-data';
import type { Coordinate } from 'ol/coordinate.js';
import { createContext } from 'svelte';

import { DamageOverlay } from './damageOverlay';

/**
 * Interaction state of the fault simulation page: the picked damage location,
 * the running/finished simulation and the map overlay that mirrors both.
 */
export class FaultSimulationState {
	/** Damage location in the storage projection, as sent to the backend. */
	damagePoint = $state.raw<[number, number] | null>(null);
	/** Damage location in the map's view projection, for anchoring the popup. */
	damageMapCoordinate = $state.raw<Coordinate | null>(null);
	selectedTrench = $state.raw<Trench | null>(null);
	simulationResult = $state.raw<FaultSimulationResult | null>(null);
	isSimulating = $state(false);

	readonly overlay = new DamageOverlay();

	/** Whether a new damage location may be picked on the map. */
	get canSelectDamagePoint(): boolean {
		return !this.isSimulating && !this.simulationResult;
	}

	/**
	 * Picks the damage location, discarding any prior simulation.
	 * @param point - Location in the storage projection.
	 * @param mapCoordinate - The same location in the map's view projection.
	 * @param trench - The trench that was hit.
	 */
	selectDamagePoint(
		point: [number, number],
		mapCoordinate: Coordinate,
		trench: Trench | null
	): void {
		this.damagePoint = point;
		this.damageMapCoordinate = mapCoordinate;
		this.selectedTrench = trench;
		this.simulationResult = null;
		this.overlay.showDamagePoint(mapCoordinate);
	}

	/**
	 * Stores a finished simulation and draws the affected features on the map.
	 * @param result - The simulation result.
	 */
	showResult(result: FaultSimulationResult): void {
		this.simulationResult = result;
		this.overlay.showResult(result);
	}

	/** Returns to the initial state and clears the map overlay. */
	reset(): void {
		this.damagePoint = null;
		this.damageMapCoordinate = null;
		this.selectedTrench = null;
		this.simulationResult = null;
		this.isSimulating = false;
		this.overlay.clear();
	}
}

export const [getFaultSimulationState, setFaultSimulationState] =
	createContext<FaultSimulationState>();
