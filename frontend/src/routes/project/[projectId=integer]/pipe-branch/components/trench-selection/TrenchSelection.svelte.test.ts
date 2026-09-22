import type { BranchConnection } from '$lib/remote/pipe-branch/connection-data';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import { commandFailure, commandResult, httpError } from '$lib/test-utils/remote-stubs';

import PipeBranchStateFixture from '../PipeBranchState.fixture.svelte';
import { PipeBranchState } from '../PipeBranchState.svelte';
import TrenchSelection from './TrenchSelection.svelte';
import { trenches } from '../branchGraph.fixture';

const getTrenchesNearNode = vi.fn();
const getTrenchSelections = vi.fn();
const saveTrenchSelections = vi.fn();
const getConnections = vi.fn();

vi.mock('$lib/remote/pipe-branch/trench-selections.remote', () => ({
	getTrenchesNearNode: (...args: unknown[]) => getTrenchesNearNode(...args),
	getTrenchSelections: (...args: unknown[]) => getTrenchSelections(...args),
	saveTrenchSelections: (...args: unknown[]) => saveTrenchSelections(...args)
}));

vi.mock('$lib/remote/pipe-branch/connections.remote', () => ({
	getConnections: (...args: unknown[]) => getConnections(...args)
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

const nearby = {
	trenches,
	count: 2,
	node_uuid: 'node-a',
	node_name: 'Node A',
	distance: 5,
	project_id: 1
};

const connection: BranchConnection = {
	uuid: 'conn-1',
	from: { microductUuid: 'm1', trenchUuid: 't1' },
	to: { microductUuid: 'm3', trenchUuid: 't2' }
};

const user = userEvent.setup();

function renderSelection() {
	const branch = new PipeBranchState('proj-1');
	branch.pickBranch('Node A');
	render(PipeBranchStateFixture, { props: { component: TrenchSelection, branch } });
	return branch;
}

beforeEach(() => {
	getTrenchesNearNode.mockResolvedValue(nearby);
	getTrenchSelections.mockResolvedValue([]);
	getConnections.mockResolvedValue([]);
	saveTrenchSelections.mockReturnValue(commandResult(undefined));
});

afterEach(() => {
	getTrenchesNearNode.mockReset();
	getTrenchSelections.mockReset();
	getConnections.mockReset();
	saveTrenchSelections.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('TrenchSelection', () => {
	test('should load the trenches around the picked branch and what is saved for its node', async () => {
		renderSelection();

		expect(await screen.findByText(/T-1/)).toBeInTheDocument();
		expect(screen.getByText(/T-2/)).toBeInTheDocument();
		expect(getTrenchesNearNode).toHaveBeenCalledWith({ nodeName: 'Node A', projectId: 'proj-1' });
		expect(getTrenchSelections).toHaveBeenCalledWith('node-a');
		expect(getConnections).toHaveBeenCalledWith('node-a');
	});

	test('should start with nothing selected for a node without history', async () => {
		renderSelection();

		expect(await screen.findByRole('button', { name: 'action_load_to_canvas' })).toBeDisabled();
	});

	test('should load the conduits of the saved trenches onto the canvas when confirmed', async () => {
		getTrenchSelections.mockResolvedValue(['t2']);
		const branch = renderSelection();

		await user.click(await screen.findByRole('button', { name: 'action_load_to_canvas' }));

		expect(branch.selecting).toBe(false);
		expect(branch.nodeUuid).toBe('node-a');
		expect(branch.canvasTrenches).toEqual([trenches[1]]);
	});

	test('should remember the confirmed trenches for the node', async () => {
		getTrenchSelections.mockResolvedValue(['t2']);
		renderSelection();

		await user.click(await screen.findByRole('button', { name: 'action_load_to_canvas' }));

		expect(saveTrenchSelections).toHaveBeenCalledExactlyOnceWith({
			nodeUuid: 'node-a',
			trenchUuids: ['t2']
		});
		await vi.waitFor(() =>
			expect(globalToaster.success).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'message_success_saving_trench_selections' })
			)
		);
	});

	test('should add everything with select all', async () => {
		const branch = renderSelection();

		await user.click(await screen.findByRole('button', { name: 'action_select_all' }));
		await user.click(screen.getByRole('button', { name: 'action_load_to_canvas' }));

		expect(branch.canvasTrenches).toEqual(trenches);
	});

	test('should keep conduits that carry a connection selected and locked', async () => {
		getConnections.mockResolvedValue([connection]);
		const branch = renderSelection();

		await user.click(await screen.findByRole('button', { name: 'action_select_none' }));
		await user.click(screen.getByRole('button', { name: 'action_load_to_canvas' }));

		expect(branch.canvasTrenches).toEqual([
			trenches[0],
			{ ...trenches[1], conduits: [trenches[1].conduits[0]] }
		]);
		expect(screen.getAllByText('message_has_connections')).toHaveLength(2);
	});

	test('should still load the canvas but report it when saving the selection fails', async () => {
		getTrenchSelections.mockResolvedValue(['t1']);
		saveTrenchSelections.mockReturnValue(commandFailure(httpError(400, 'Selection rejected')));
		const branch = renderSelection();

		await user.click(await screen.findByRole('button', { name: 'action_load_to_canvas' }));

		expect(branch.canvasTrenches).toEqual([trenches[0]]);
		await vi.waitFor(() =>
			expect(globalToaster.error).toHaveBeenCalledWith(
				expect.objectContaining({ description: 'Selection rejected' })
			)
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});

	test('should save the selection once however often it is confirmed', async () => {
		getTrenchSelections.mockResolvedValue(['t2']);
		renderSelection();
		const confirm = await screen.findByRole('button', { name: 'action_load_to_canvas' });

		await user.dblClick(confirm);

		expect(saveTrenchSelections).toHaveBeenCalledOnce();
	});

	test('should empty the canvas when cancelled', async () => {
		const branch = renderSelection();

		await user.click(await screen.findByRole('button', { name: 'common_cancel' }));

		expect(branch.selecting).toBe(false);
		expect(branch.nodeUuid).toBeNull();
		expect(saveTrenchSelections).not.toHaveBeenCalled();
	});

	test('should say so and lead back when no trench is near the node', async () => {
		getTrenchesNearNode.mockResolvedValue({ ...nearby, trenches: [], count: 0 });
		const branch = renderSelection();

		expect(await screen.findByText('message_no_trenches_near_node')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'action_load_to_canvas' })).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'common_back' }));

		expect(branch.selecting).toBe(false);
	});

	test('should surface a failed trench request', async () => {
		getTrenchesNearNode.mockRejectedValue(httpError(404, 'Node not found'));

		renderSelection();

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
