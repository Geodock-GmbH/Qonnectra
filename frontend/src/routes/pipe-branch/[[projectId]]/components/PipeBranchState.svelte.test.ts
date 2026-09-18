import type { TrenchesNearNodeTrench } from '$lib/types';
import { describe, expect, test } from 'vitest';

import { PipeBranchState } from './PipeBranchState.svelte';

const trenches: TrenchesNearNodeTrench[] = [{ uuid: 't1', id_trench: 'T-1', conduits: [] }];

function stateWithCanvas(): PipeBranchState {
	const state = new PipeBranchState('proj-1');
	state.pickBranch('Node A');
	state.showOnCanvas('node-a', trenches);
	state.lassoSelection = ['trench-t1-conduit-c1'];
	return state;
}

describe('PipeBranchState', () => {
	test('should open the trench selector when a branch is picked', () => {
		const state = new PipeBranchState('proj-1');

		state.pickBranch('Node A');

		expect(state.selectedBranch).toBe('Node A');
		expect(state.selecting).toBe(true);
	});

	test('should empty the canvas of the previous branch when another is picked', () => {
		const state = stateWithCanvas();

		state.pickBranch('Node B');

		expect(state.nodeUuid).toBeNull();
		expect(state.canvasTrenches).toEqual([]);
		expect(state.lassoSelection).toEqual([]);
	});

	test('should not open the trench selector when the combobox is cleared', () => {
		const state = stateWithCanvas();

		state.pickBranch('');

		expect(state.selecting).toBe(false);
		expect(state.canvasTrenches).toEqual([]);
	});

	test('should load the confirmed selection onto the canvas', () => {
		const state = new PipeBranchState('proj-1');
		state.pickBranch('Node A');

		state.showOnCanvas('node-a', trenches);

		expect(state.selecting).toBe(false);
		expect(state.nodeUuid).toBe('node-a');
		expect(state.canvasTrenches).toBe(trenches);
	});

	test('should keep the canvas while the selection is edited', () => {
		const state = stateWithCanvas();

		state.editSelection();

		expect(state.selecting).toBe(true);
		expect(state.canvasTrenches).toBe(trenches);
	});

	test('should empty the canvas but keep the picked branch when the selection is cancelled', () => {
		const state = stateWithCanvas();
		state.editSelection();

		state.cancelSelection();

		expect(state.selecting).toBe(false);
		expect(state.nodeUuid).toBeNull();
		expect(state.canvasTrenches).toEqual([]);
		expect(state.selectedBranch).toBe('Node A');
	});

	test('should drop the lasso selection when the lasso is turned off', () => {
		const state = stateWithCanvas();
		state.setLassoMode(true);

		state.setLassoMode(false);

		expect(state.lassoMode).toBe(false);
		expect(state.lassoSelection).toEqual([]);
	});

	test('should keep the lasso selection when the lasso is turned on', () => {
		const state = stateWithCanvas();

		state.setLassoMode(true);

		expect(state.lassoSelection).toEqual(['trench-t1-conduit-c1']);
	});
});
