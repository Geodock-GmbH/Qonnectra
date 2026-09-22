import type { TrenchesNearNodeTrench } from '$lib/types';
import { createContext } from 'svelte';

/**
 * Interaction state of the pipe-branch page: the picked branch, the conduits
 * loaded onto the canvas and the lasso selection used for auto-connecting.
 */
export class PipeBranchState {
	/** Name of the pipe-branch node picked in the combobox. */
	selectedBranch = $state('');
	/** Whether the trench selector is open for the picked branch. */
	selecting = $state(false);
	/** The node whose connections the canvas shows, as resolved by the backend. */
	nodeUuid = $state<string | null>(null);
	/** The trenches on the canvas, each holding only its selected conduits. */
	canvasTrenches = $state.raw<TrenchesNearNodeTrench[]>([]);

	lassoMode = $state(false);
	partialSelection = $state(false);
	/** IDs of the canvas nodes inside the lasso. */
	lassoSelection = $state.raw<string[]>([]);

	/**
	 * @param projectId - Project whose pipe branches are shown; empty when none is selected.
	 */
	constructor(readonly projectId: string) {}

	/**
	 * Switches to another branch: empties the canvas and opens the trench
	 * selector, or just empties the canvas when the combobox was cleared.
	 * @param name - Name of the picked node, empty when cleared.
	 */
	pickBranch(name: string): void {
		this.selectedBranch = name;
		this.clearCanvas();
		this.selecting = name !== '';
	}

	/** Reopens the trench selector for the branch on the canvas. */
	editSelection(): void {
		this.selecting = true;
	}

	/** Closes the trench selector and empties the canvas. */
	cancelSelection(): void {
		this.selecting = false;
		this.clearCanvas();
	}

	/**
	 * Closes the trench selector and loads its selection onto the canvas.
	 * @param nodeUuid - The pipe-branch node the trenches belong to.
	 * @param trenches - The selected trenches, holding only their selected conduits.
	 */
	showOnCanvas(nodeUuid: string, trenches: TrenchesNearNodeTrench[]): void {
		this.selecting = false;
		this.nodeUuid = nodeUuid;
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

	private clearCanvas(): void {
		this.nodeUuid = null;
		this.canvasTrenches = [];
		this.lassoSelection = [];
	}
}

export const [getPipeBranchState, setPipeBranchState] = createContext<PipeBranchState>();
