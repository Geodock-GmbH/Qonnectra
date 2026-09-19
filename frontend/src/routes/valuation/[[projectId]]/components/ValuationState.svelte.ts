import type { ProjectionRow } from './valuationCalc';
import type { ValuationResult } from '$lib/remote/valuation/valuation-data';
import { createContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { fromStore } from 'svelte/store';
import { page } from '$app/state';

import { globalMapView, selectedProject } from '$lib/stores/store';

import { AreaHighlight } from './areaHighlight';
import { computeProjection } from './valuationCalc';

/**
 * Interaction state of the valuation page: which part of the project is
 * valued, the projection inputs, the last calculated valuation and the map
 * overlay outlining the selected areas.
 */
export class ValuationState {
	/** Whether the valuation covers the whole project instead of selected areas. */
	wholeProject = $state(true);
	readonly selectedAreaUuids = new SvelteSet<string>();
	result = $state.raw<ValuationResult | null>(null);

	/** Build-completion year the projection starts from; `undefined` while the input is empty. */
	baseYear = $state<number | undefined>(new Date().getFullYear());
	/** Yearly value correction in percent; `undefined` while the input is empty. */
	annualCorrectionPercent = $state<number | undefined>(2.5);

	/** Counts the resets, so a calculation started before one can tell that it is outdated. */
	resetCount = 0;

	readonly highlight = new AreaHighlight();

	readonly #selectedProject = fromStore(selectedProject);
	readonly #globalView = fromStore(globalMapView);

	/**
	 * The projection is derived client-side so it follows the inputs without
	 * another calculation once a valuation exists.
	 */
	readonly projectionRows: ProjectionRow[] = $derived.by(() => {
		const { result, baseYear, annualCorrectionPercent } = this;
		if (!result || !baseYear || typeof annualCorrectionPercent !== 'number') return [];
		if (!Number.isFinite(annualCorrectionPercent)) return [];
		return computeProjection(result.total, baseYear, annualCorrectionPercent / 100);
	});

	/** The project that is valued. Cost rates belong to one project, also in the global view. */
	get projectId(): string {
		return page.params.projectId ?? this.#selectedProject.current ?? '';
	}

	/** Project whose areas can be selected; empty in the global view, which offers all areas. */
	get areaScope(): string {
		return this.#globalView.current ? '' : this.projectId;
	}

	/** Whether there is something to calculate: the whole project or at least one area. */
	get selectionValid(): boolean {
		return this.wholeProject || this.selectedAreaUuids.size > 0;
	}

	/** The areas the calculation is restricted to; empty covers the whole project. */
	get areaUuids(): string[] {
		return this.wholeProject ? [] : Array.from(this.selectedAreaUuids);
	}

	/** Switches between the whole project and picking areas. */
	toggleWholeProject(): void {
		this.wholeProject = !this.wholeProject;
		if (this.wholeProject) this.selectedAreaUuids.clear();
	}

	/**
	 * Adds an area to the selection or removes it again.
	 * @param uuid - UUID of the area.
	 */
	toggleArea(uuid: string): void {
		if (this.selectedAreaUuids.delete(uuid)) return;
		this.selectedAreaUuids.add(uuid);
		this.wholeProject = false;
	}

	/** Returns to valuing the whole project and drops the last valuation. */
	reset(): void {
		this.selectedAreaUuids.clear();
		this.wholeProject = true;
		this.result = null;
		this.resetCount += 1;
	}
}

export const [getValuationState, setValuationState] = createContext<ValuationState>();
