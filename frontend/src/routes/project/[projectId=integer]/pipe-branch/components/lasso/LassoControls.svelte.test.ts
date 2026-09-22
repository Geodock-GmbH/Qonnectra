import type { BranchConnection } from '$lib/remote/pipe-branch/connection-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { commandResult, httpError, queryResult } from '$lib/test-utils/remote-stubs';

import PipeBranchStateFixture from '../PipeBranchState.fixture.svelte';
import { PipeBranchState } from '../PipeBranchState.svelte';
import LassoControls from './LassoControls.svelte';
import { trenches } from '../branchGraph.fixture';

const getConnections = vi.fn();
const createConnections = vi.fn();
const updateNodes = vi.fn();

vi.mock('$lib/remote/pipe-branch/connections.remote', () => ({
	getConnections: (...args: unknown[]) => getConnections(...args),
	createConnections: (...args: unknown[]) => createConnections(...args)
}));

vi.mock('@xyflow/svelte', () => ({
	useNodes: () => ({ current: [], update: updateNodes, set: vi.fn() })
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('$lib/stores/toaster', () => ({
	globalToaster: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('$lib/utils/logToBackendClient', () => ({
	logToBackendClient: vi.fn().mockResolvedValue(undefined)
}));

const CONDUIT_1 = 'trench-t1-conduit-c1';
const CONDUIT_2 = 'trench-t2-conduit-c2';
const CONDUIT_3 = 'trench-t2-conduit-c3';

const user = userEvent.setup();

function renderControls(lassoSelection: string[], lassoMode = true) {
	const branch = new PipeBranchState('proj-1');
	branch.pickBranch('Node A');
	branch.showOnCanvas('node-a', trenches);
	branch.setLassoMode(lassoMode);
	branch.lassoSelection = lassoSelection;
	render(PipeBranchStateFixture, { props: { component: LassoControls, branch } });
	return branch;
}

beforeEach(() => {
	getConnections.mockReturnValue(queryResult<BranchConnection[]>([]));
	createConnections.mockReturnValue(commandResult({ created: 2, errors: [] }));
});

afterEach(() => {
	getConnections.mockReset();
	createConnections.mockReset();
	updateNodes.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('LassoControls', () => {
	test('should offer no selection actions while the lasso is off', () => {
		renderControls([CONDUIT_1, CONDUIT_2], false);

		expect(
			screen.queryByRole('button', { name: 'action_connect_selected_nodes' })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'action_clear_selection' })
		).not.toBeInTheDocument();
	});

	test('should offer no selection actions for an empty lasso', () => {
		renderControls([]);

		expect(
			screen.queryByRole('button', { name: 'action_clear_selection' })
		).not.toBeInTheDocument();
	});

	test('should connect the microducts that share a number between two selected conduits', async () => {
		renderControls([CONDUIT_1, CONDUIT_2]);

		await user.click(screen.getByRole('button', { name: 'action_connect_selected_nodes' }));

		expect(createConnections).toHaveBeenCalledExactlyOnceWith({
			nodeUuid: 'node-a',
			pairs: [
				{
					from: { microductUuid: 'm1', trenchUuid: 't1' },
					to: { microductUuid: 'm3', trenchUuid: 't2' }
				},
				{
					from: { microductUuid: 'm2', trenchUuid: 't1' },
					to: { microductUuid: 'm4', trenchUuid: 't2' }
				}
			]
		});
	});

	test('should leave out microducts that are already connected', async () => {
		getConnections.mockReturnValue(
			queryResult<BranchConnection[]>([
				{
					uuid: 'conn-1',
					from: { microductUuid: 'm3', trenchUuid: 't2' },
					to: { microductUuid: 'm1', trenchUuid: 't1' }
				}
			])
		);
		renderControls([CONDUIT_1, CONDUIT_2]);

		await user.click(screen.getByRole('button', { name: 'action_connect_selected_nodes' }));

		expect(createConnections).toHaveBeenCalledExactlyOnceWith({
			nodeUuid: 'node-a',
			pairs: [
				{
					from: { microductUuid: 'm2', trenchUuid: 't1' },
					to: { microductUuid: 'm4', trenchUuid: 't2' }
				}
			]
		});
	});

	test('should report it instead of connecting when the existing connections cannot be read', async () => {
		getConnections.mockImplementation(() => Promise.reject(httpError(502, 'Backend unavailable')));
		renderControls([CONDUIT_1, CONDUIT_2]);

		await user.click(screen.getByRole('button', { name: 'action_connect_selected_nodes' }));

		expect(createConnections).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'Backend unavailable' })
		);
	});

	test('should say so when the two conduits share no microduct number', async () => {
		renderControls([CONDUIT_1, CONDUIT_3]);

		await user.click(screen.getByRole('button', { name: 'action_connect_selected_nodes' }));

		expect(createConnections).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'message_error_no_matching_microducts' })
		);
	});

	test('should ask for exactly two conduits instead of connecting three', () => {
		renderControls([CONDUIT_1, CONDUIT_2, CONDUIT_3]);

		expect(screen.getByText('form_select_exactly_2_nodes')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'action_connect_selected_nodes' })
		).not.toBeInTheDocument();
	});

	test('should turn the lasso on from the switch', async () => {
		const branch = renderControls([], false);

		await user.click(screen.getByRole('checkbox', { hidden: true }));

		expect(branch.lassoMode).toBe(true);
	});

	test('should drop the selection when the lasso is switched off', async () => {
		const branch = renderControls([CONDUIT_1, CONDUIT_2]);

		await user.click(screen.getAllByRole('checkbox', { hidden: true })[0]);

		expect(branch.lassoMode).toBe(false);
		expect(branch.lassoSelection).toEqual([]);
		expect(updateNodes).toHaveBeenCalledOnce();
	});

	test('should drop the selection and deselect the canvas nodes when cleared', async () => {
		const branch = renderControls([CONDUIT_1, CONDUIT_2]);

		await user.click(screen.getByRole('button', { name: 'action_clear_selection' }));

		expect(branch.lassoSelection).toEqual([]);
		const deselect = updateNodes.mock.calls[0][0];
		expect(deselect([{ id: CONDUIT_1, selected: true }])).toEqual([
			{ id: CONDUIT_1, selected: false }
		]);
	});
});
