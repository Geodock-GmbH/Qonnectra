import { getContext, setContext } from 'svelte';

const FAULT_SIMULATION_CONTEXT_KEY = Symbol('faultSimulationContext');

/**
 * @typedef {Object} FaultSimulationContext
 * @property {[number, number]|null} damagePoint
 * @property {Record<string, any>|null} selectedTrench
 * @property {Record<string, any>|null} simulationResult
 * @property {boolean} isSimulating
 * @property {string|null} selectedCableId
 * @property {(point: [number, number]|null, trench: Record<string, any>|null) => void} setDamagePoint
 * @property {(result: Record<string, any>|null) => void} setSimulationResult
 * @property {(id: string|null) => void} setSelectedCable
 * @property {() => void} reset
 */

/**
 * Creates and sets the fault simulation context.
 * @returns {FaultSimulationContext}
 */
export function createFaultSimulationContext() {
	/** @type {[number, number]|null} */
	let damagePoint = $state(null);
	/** @type {Record<string, any>|null} */
	let selectedTrench = $state(null);
	/** @type {Record<string, any>|null} */
	let simulationResult = $state(null);
	let isSimulating = $state(false);
	/** @type {string|null} */
	let selectedCableId = $state(null);

	const context = {
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
		set isSimulating(value) {
			isSimulating = value;
		},
		get selectedCableId() {
			return selectedCableId;
		},
		/**
		 * Sets the damage point and associated trench, resetting any prior simulation.
		 * @param {[number, number]|null} point - Coordinate pair in storage projection
		 * @param {Record<string, any>|null} trench - Trench properties at the damage location
		 * @returns {void}
		 */
		setDamagePoint(point, trench) {
			damagePoint = point;
			selectedTrench = trench;
			simulationResult = null;
			selectedCableId = null;
		},
		/**
		 * Stores the simulation result returned by the backend.
		 * @param {Record<string, any>|null} result - Simulation response data or null to clear
		 * @returns {void}
		 */
		setSimulationResult(result) {
			simulationResult = result;
		},
		/**
		 * Selects a cable by UUID for detail display.
		 * @param {string|null} id - Cable UUID or null to deselect
		 * @returns {void}
		 */
		setSelectedCable(id) {
			selectedCableId = id;
		},
		/** @returns {void} */
		reset() {
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
 * @returns {FaultSimulationContext}
 */
export function getFaultSimulationContext() {
	return getContext(FAULT_SIMULATION_CONTEXT_KEY);
}
