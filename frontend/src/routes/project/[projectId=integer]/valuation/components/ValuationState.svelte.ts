import type { ProjectionRow } from './valuationCalc';
import type { ValuationRequest } from './valuationRequest';
import type { ValuationResult } from '$lib/remote/valuation/valuation-data';
import { createContext } from 'svelte';
import { fromStore } from 'svelte/store';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';

import { globalMapView } from '$lib/stores/store';
import { setQuery } from '$lib/utils/urlState';
import { routeProjectId } from '$lib/context/project';
import { calculateValuation } from '$lib/remote/valuation/valuation.remote';

import { AreaHighlight } from './areaHighlight';
import { computeProjection } from './valuationCalc';
import {
	DEFAULT_CORRECTION_PERCENT,
	defaultBaseYear,
	MAX_URL_AREAS,
	valuationRequestFromUrl
} from './valuationRequest';

/**
 * State of the valuation page. What is valued and projected lives in the
 * URL (`?areas=…&baseYear=…&correction=…`); the valuation is the remote
 * query of those inputs, so a reload or a shared link shows the same
 * totals. Only two transient things live in `page.state` instead: picking
 * areas before the first one is chosen, and a selection too long for a
 * link. They are history state rather than component state so that a click
 * changes them in the same navigation as the URL; under async rendering, a
 * `$state` write and a navigation become separate batches that can leave the
 * checkboxes out of sync with the results.
 */
export class ValuationState {
	readonly highlight = new AreaHighlight();

	readonly #globalView = fromStore(globalMapView);

	/** Areas mode entered without a pick yet; transient, so not in the URL. */
	get #pickingAreas(): boolean {
		return page.state.valuation?.pickingAreas ?? false;
	}

	/** A selection too long for the URL, kept on the page with a hint. */
	get #localAreas(): string[] | null {
		return page.state.valuation?.localAreas ?? null;
	}

	/** The project that is valued, from the URL. Cost rates belong to one project, also in the global view. */
	get projectId(): string {
		return routeProjectId();
	}

	/** Project whose areas can be selected; empty in the global view, which offers all areas. */
	get areaScope(): string {
		return this.#globalView.current ? '' : this.projectId;
	}

	/** The inputs as the URL names them. */
	get request(): ValuationRequest {
		return valuationRequestFromUrl(page.url);
	}

	/** The selected areas: the URL's, or the page-only selection when it is too long for a link. */
	readonly selectedAreaUuids: ReadonlySet<string> = $derived(
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- derived snapshot, never mutated
		new Set(this.#localAreas ?? this.request.areaUuids)
	);

	/** Whether the selection is too long for the URL and therefore not shareable. */
	get selectionBeyondUrl(): boolean {
		return this.#localAreas !== null;
	}

	/** Whether the valuation covers the whole project instead of selected areas. */
	get wholeProject(): boolean {
		return !this.#pickingAreas && this.selectedAreaUuids.size === 0;
	}

	/** Whether there is something to calculate: the whole project or at least one area. */
	get selectionValid(): boolean {
		return this.wholeProject || this.selectedAreaUuids.size > 0;
	}

	/** The areas the calculation is restricted to; empty covers the whole project. */
	get areaUuids(): string[] {
		return this.wholeProject ? [] : Array.from(this.selectedAreaUuids);
	}

	/** Build-completion year the projection starts from, from the URL. */
	get baseYear(): number {
		return this.request.baseYear;
	}

	/** Yearly value correction in percent, from the URL. */
	get annualCorrectionPercent(): number {
		return this.request.correction;
	}

	/**
	 * The valuation of the current selection, to be awaited inside a boundary
	 * by whatever shows it; null while there is nothing valid to value. The
	 * backend computes it read-only, so the same selection is one request.
	 */
	get query(): ReturnType<typeof calculateValuation> | null {
		if (!this.selectionValid) return null;
		return calculateValuation({ projectId: this.projectId, areaUuids: this.areaUuids });
	}

	/**
	 * Projects a valuation over the years from the base year, client-side, so
	 * it follows the inputs without another calculation.
	 * @param result - The calculated valuation.
	 * @returns One row per projected year.
	 */
	projectionRowsFor(result: ValuationResult): ProjectionRow[] {
		const { baseYear, annualCorrectionPercent } = this;
		if (!Number.isFinite(annualCorrectionPercent)) return [];
		return computeProjection(result.total, baseYear, annualCorrectionPercent / 100);
	}

	/** Switches between the whole project and picking areas. */
	toggleWholeProject(): void {
		if (this.wholeProject) {
			this.#setPageState({ pickingAreas: true });
			return;
		}
		void this.reset();
	}

	/**
	 * Adds an area to the selection or removes it again. The selection is an
	 * adjustment of the page, so the URL entry is rewritten; a selection too
	 * long for a link stays on the page instead.
	 * @param uuid - UUID of the area.
	 */
	toggleArea(uuid: string): void {
		const current = Array.from(this.selectedAreaUuids);
		const next = current.includes(uuid)
			? current.filter((candidate) => candidate !== uuid)
			: [...current, uuid];
		if (next.length > MAX_URL_AREAS) {
			this.#setPageState({ localAreas: next });
			return;
		}
		void setQuery({ areas: next.join(',') || null });
	}

	/**
	 * Sets the year the projection starts from; the default is never written.
	 * @param year - The year, or undefined to return to the default.
	 */
	setBaseYear(year: number | undefined): void {
		const value = year !== undefined && Number.isFinite(year) ? year : undefined;
		void setQuery(
			{ baseYear: value === undefined || value === defaultBaseYear() ? null : value },
			{ state: page.state }
		);
	}

	/**
	 * Sets the yearly value correction; the default is never written.
	 * @param percent - The correction in percent, or undefined to return to the default.
	 */
	setAnnualCorrection(percent: number | undefined): void {
		const value = percent !== undefined && Number.isFinite(percent) ? percent : undefined;
		void setQuery(
			{ correction: value === undefined || value === DEFAULT_CORRECTION_PERCENT ? null : value },
			{ state: page.state }
		);
	}

	/**
	 * Returns to valuing the whole project, dropping the selection from the
	 * URL and the page-only selection; the projection inputs stay.
	 * @returns Resolves once the navigation has completed.
	 */
	async reset(): Promise<void> {
		if (this.request.areaUuids.length > 0) {
			await setQuery({ areas: null });
		} else if (page.state.valuation) {
			this.#setPageState(undefined);
		}
	}

	/**
	 * Replaces the page-only selection without a navigation or a URL change.
	 * @param valuation - The new page-only selection; undefined clears it.
	 */
	#setPageState(valuation: App.PageState['valuation']): void {
		replaceState('', { ...page.state, valuation });
	}
}

export const [getValuationState, setValuationState] = createContext<ValuationState>();
