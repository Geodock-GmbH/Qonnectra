import type { TrenchesNearNodeTrench } from '$lib/types';
import { describe, expect, test } from 'vitest';

import { PipeBranchState } from './PipeBranchState.svelte';

const trenches: TrenchesNearNodeTrench[] = [{ uuid: 't1', id_trench: 'T-1', conduits: [] }];
const node = { uuid: 'node-a', name: 'Node A' };

function stateWithCanvas(): PipeBranchState {
	const state = new PipeBranchState('proj-1', node);
	state.showOnCanvas(trenches);
	state.lassoSelection = ['trench-t1-conduit-c1'];
	return state;
}

describe('PipeBranchState', () => {
	test('should take the node from the URL', () => {
		const state = new PipeBranchState('proj-1', node);

		expect(state.nodeUuid).toBe('node-a');
		expect(state.selectedBranch).toBe('Node A');
		expect(state.selecting).toBe(false);
	});

	test('should have no node on the page without one', () => {
		const state = new PipeBranchState('proj-1');

		expect(state.nodeUuid).toBeNull();
		expect(state.selectedBranch).toBe('');
	});

	test('should load the confirmed selection onto the canvas', () => {
		const state = new PipeBranchState('proj-1', node);
		state.editSelection();

		state.showOnCanvas(trenches);

		expect(state.selecting).toBe(false);
		expect(state.canvasTrenches).toBe(trenches);
		expect(state.lassoSelection).toEqual([]);
	});

	test('should keep the canvas while the selection is edited', () => {
		const state = stateWithCanvas();

		state.editSelection();

		expect(state.selecting).toBe(true);
		expect(state.canvasTrenches).toBe(trenches);
	});

	test('should keep the canvas and the node when the selection is cancelled', () => {
		const state = stateWithCanvas();
		state.editSelection();

		state.cancelSelection();

		expect(state.selecting).toBe(false);
		expect(state.nodeUuid).toBe('node-a');
		expect(state.canvasTrenches).toBe(trenches);
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
