import type { FaultSimulationResult } from '$lib/remote/fault-simulation/simulation-data';
import { createContext } from 'svelte';
import { page } from '$app/state';

import { setQuery } from '$lib/utils/urlState';
import { routeProjectId } from '$lib/context/project';
import { simulateFault } from '$lib/remote/fault-simulation/simulation.remote';

import { DamageOverlay } from './damageOverlay';
import { formatDamage, queryDamage } from './damageParam';

/**
 * State of the fault simulation page. The damage location lives in the URL
 * (`?damage=x,y`), the simulation is the remote query of that location, and
 * the map overlay mirrors both. Nothing here is a second source: picking a
 * location navigates, and a shared URL re-runs the same simulation.
 */
export class FaultSimulationState {
	readonly overlay = new DamageOverlay();

	/** A result handed in by the dev-only e2e hook instead of the backend. */
	#injected = $state.raw<FaultSimulationResult | null>(null);

	/** Project the simulation runs in, from the URL. */
	get projectId(): string {
		return routeProjectId();
	}

	/** Damage location in the storage projection, from the URL; null while none is picked. */
	get damagePoint(): [number, number] | null {
		return queryDamage(page.url);
	}

	/**
	 * The simulation of the damage in the URL, shared by everything that
	 * shows it: the same location in the same project is one request.
	 */
	get query(): ReturnType<typeof simulateFault> | null {
		const point = this.damagePoint;
		return point ? simulateFault({ point, projectId: this.projectId }) : null;
	}

	/** The finished simulation, or null while none is picked or it is still running. */
	get simulationResult(): FaultSimulationResult | null {
		return this.#injected ?? this.query?.current ?? null;
	}

	/** The damaged trench, part of the result. */
	get selectedTrench(): FaultSimulationResult['trench'] {
		return this.simulationResult?.trench ?? null;
	}

	/** Whether the simulation of the damage in the URL is still running. */
	get isSimulating(): boolean {
		return this.#injected ? false : (this.query?.loading ?? false);
	}

	/** Whether a damage location may be picked on the map: only while none is shown. */
	get canSelectDamagePoint(): boolean {
		return this.damagePoint === null && this.#injected === null;
	}

	/**
	 * Picks the damage location by naming it in the URL, a place the back
	 * button returns from; the simulation follows from the URL.
	 * @param point - Location in the storage projection.
	 * @returns Resolves once the navigation has completed.
	 */
	selectDamagePoint(point: [number, number]): Promise<void> {
		return setQuery({ damage: formatDamage(point) }, { push: true });
	}

	/**
	 * Shows a result that did not come from the backend. Only the dev-only
	 * e2e hook uses this; the app itself derives the result from the URL.
	 * @param result - The simulation result.
	 */
	showResult(result: FaultSimulationResult): void {
		this.#injected = result;
		this.overlay.showResult(result);
	}

	/**
	 * Returns to the initial state: clears the overlay and removes the damage
	 * from the URL, rewriting the entry so back never reopens the simulation.
	 * @returns Resolves once the navigation has completed.
	 */
	async reset(): Promise<void> {
		this.#injected = null;
		this.overlay.clear();
		if (this.damagePoint) await setQuery({ damage: null });
	}
}

export const [getFaultSimulationState, setFaultSimulationState] =
	createContext<FaultSimulationState>();
