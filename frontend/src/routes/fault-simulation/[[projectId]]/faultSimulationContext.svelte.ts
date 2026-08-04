import type { FaultSimulationResult } from './exportCsv.js';
import { getContext, setContext } from 'svelte';

const FAULT_SIMULATION_CONTEXT_KEY = Symbol('faultSimulationContext');

interface Trench {
	id_trench: string;
	construction_type: string;
	[key: string]: unknown;
}

export interface FaultSimulationContext {
	damagePoint: [number, number] | null;
	selectedTrench: Trench | null;
	simulationResult: FaultSimulationResult | null;
	isSimulating: boolean;
	selectedCableId: string | null;
	setDamagePoint: (point: [number, number] | null, trench: Trench | null) => void;
	setSimulationResult: (result: FaultSimulationResult | null) => void;
	setSelectedCable: (id: string | null) => void;
	reset: () => void;
}

/**
 * Creates and sets the fault simulation context.
 */
export function createFaultSimulationContext(): FaultSimulationContext {
	let damagePoint: [number, number] | null = $state(null);
	let selectedTrench: Trench | null = $state(null);
	let simulationResult: FaultSimulationResult | null = $state(null);
	let isSimulating: boolean = $state(false);
	let selectedCableId: string | null = $state(null);

	const context: FaultSimulationContext = {
		get damagePoint() {
			return damagePoint;
		},
		get selectedTrench() {
			return selectedTrench;
		},
		get simulationResult() {
			return simulationResult;
		},
		get isSimulating() {
			return isSimulating;
		},
		set isSimulating(value: boolean) {
			isSimulating = value;
		},
		get selectedCableId() {
			return selectedCableId;
		},
		/**
		 * Sets the damage point and associated trench, resetting any prior simulation.
		 * @param point - Coordinate pair in storage projection
		 * @param trench - Trench properties at the damage location
		 */
		setDamagePoint(point: [number, number] | null, trench: Trench | null): void {
			damagePoint = point;
			selectedTrench = trench;
			simulationResult = null;
			selectedCableId = null;
		},
		/**
		 * Stores the simulation result returned by the backend.
		 * @param result - Simulation response data or null to clear
		 */
		setSimulationResult(result: FaultSimulationResult | null): void {
			simulationResult = result;
		},
		/**
		 * Selects a cable by UUID for detail display.
		 * @param id - Cable UUID or null to deselect
		 */
		setSelectedCable(id: string | null): void {
			selectedCableId = id;
		},
		reset(): void {
			damagePoint = null;
			selectedTrench = null;
			simulationResult = null;
			isSimulating = false;
			selectedCableId = null;
		}
	};

	setContext(FAULT_SIMULATION_CONTEXT_KEY, context);
	return context;
}

/**
 * Gets the fault simulation context.
 */
export function getFaultSimulationContext(): FaultSimulationContext {
	return getContext<FaultSimulationContext>(FAULT_SIMULATION_CONTEXT_KEY);
}
