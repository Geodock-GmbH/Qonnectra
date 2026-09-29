import type { PipeBranchNodeRef } from './savedCanvas';
import type { TrenchesNearNodeTrench } from '$lib/types';
import { createContext } from 'svelte';

/**
 * Interaction state of the pipe-branch page for one node: the conduits
 * loaded onto the canvas, whether the trench selector is open, and the lasso
 * selection used for auto-connecting. Which node is shown comes from the
 * URL; the page creates a fresh state per node.
 */
export class PipeBranchState {
	/** Whether the trench selector is open for the node. */
	selecting = $state(false);
	/** The trenches on the canvas, each holding only its selected conduits. */
	canvasTrenches = $state.raw<TrenchesNearNodeTrench[]>([]);

	lassoMode = $state(false);
	partialSelection = $state(false);
	/** IDs of the canvas nodes inside the lasso. */
	lassoSelection = $state.raw<string[]>([]);

	/**
	 * @param projectId - Project whose pipe branches are shown.
	 * @param node - The node named in the URL, or null on the page without one.
	 */
	constructor(
		readonly projectId: string,
		readonly node: PipeBranchNodeRef | null = null
	) {}

	/** The node whose connections the canvas shows, or null without one. */
	get nodeUuid(): string | null {
		return this.node?.uuid ?? null;
	}

	/** Name of the node named in the URL, as the combobox shows it; empty without one. */
	get selectedBranch(): string {
		return this.node?.name ?? '';
	}

	/** Opens the trench selector for the node. */
	editSelection(): void {
		this.selecting = true;
	}

	/** Closes the trench selector, keeping whatever the canvas shows. */
	cancelSelection(): void {
		this.selecting = false;
	}

	/**
	 * Closes the trench selector and loads a selection onto the canvas.
	 * @param trenches - The selected trenches, holding only their selected conduits.
	 */
	showOnCanvas(trenches: TrenchesNearNodeTrench[]): void {
		this.selecting = false;
		this.canvasTrenches = trenches;
		this.lassoSelection = [];
	}

	/**
	 * Turns the lasso on or off; turning it off drops its selection.
	 * @param enabled - Whether the lasso replaces panning and dragging.
	 */
	setLassoMode(enabled: boolean): void {
		this.lassoMode = enabled;
		if (!enabled) this.lassoSelection = [];
	}
}

export const [getPipeBranchState, setPipeBranchState] = createContext<PipeBranchState>();
