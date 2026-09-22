import type { BranchConnection } from '$lib/remote/pipe-branch/connection-data';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import BoundaryFixture from '$lib/test-utils/Boundary.fixture.svelte';
import { commandResult, httpError, queryResult } from '$lib/test-utils/remote-stubs';

import PipeBranchCanvas from './PipeBranchCanvas.svelte';
import { trenches } from './branchGraph.fixture';

const getConnections = vi.fn();
const createConnections = vi.fn();
const getTrenchesNearNode = vi.fn();
const getTrenchSelections = vi.fn();

vi.mock('$lib/remote/pipe-branch/connections.remote', () => ({
	getConnections: (...args: unknown[]) => getConnections(...args),
	createConnections: (...args: unknown[]) => createConnections(...args),
	deleteConnection: vi.fn()
}));

vi.mock('$lib/remote/pipe-branch/trench-selections.remote', () => ({
	getTrenchesNearNode: (...args: unknown[]) => getTrenchesNearNode(...args),
	getTrenchSelections: (...args: unknown[]) => getTrenchSelections(...args),
	saveTrenchSelections: vi.fn()
}));

vi.mock('@xyflow/svelte', async () => {
	const { default: SvelteFlow } = await import('./SvelteFlowStub.fixture.svelte');
	const { default: Panel } = await import('$lib/test-utils/mocks/Panel.svelte');
	const { default: Empty } = await import('$lib/test-utils/mocks/Controls.svelte');
	return {
		SvelteFlow,
		Panel,
		Background: Empty,
		Controls: Empty,
		ConnectionMode: { Loose: 'loose' }
	};
});

vi.mock('@xyflow/svelte/dist/style.css', () => ({}));

vi.mock('./PipeBranchPanel.svelte', async () => {
	const { default: PipeBranchPanelStub } = await import('./PipeBranchPanelStub.fixture.svelte');
	return { default: PipeBranchPanelStub };
});

vi.mock('./lasso/PipeBranchLasso.svelte', async () => {
	const { default: MockPipeBranchLasso } =
		await import('$lib/test-utils/mocks/MockPipeBranchLasso.svelte');
	return { default: MockPipeBranchLasso };
});

vi.mock('./PipeBranchEdge.svelte', () => ({ default: vi.fn() }));
vi.mock('./PipeBranchNode.svelte', () => ({ default: vi.fn() }));

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

const saved: BranchConnection = {
	uuid: 'conn-1',
	from: { microductUuid: 'm1', trenchUuid: 't1' },
	to: { microductUuid: 'm3', trenchUuid: 't2' }
};

const user = userEvent.setup();

const nodeA = { uuid: 'node-a', name: 'Node A' };

const nearby = {
	trenches,
	count: 2,
	node_uuid: 'node-a',
	node_name: 'Node A',
	distance: 5,
	project_id: 1
};

/**
 * @param node - The node the URL names; omitted for the page without one.
 */
function renderCanvas(node: { uuid: string; name: string } | null = null) {
	return render(BoundaryFixture, {
		props: { component: PipeBranchCanvas, props: { projectId: 'proj-1', node } }
	});
}

async function loadSelection() {
	await user.click(await screen.findByRole('button', { name: 'load selection' }));
	await within(screen.getByRole('list', { name: 'nodes' })).findByText('trench-t1-conduit-c1');
}

beforeEach(() => {
	getConnections.mockImplementation(() => queryResult<BranchConnection[]>([saved]));
	createConnections.mockReturnValue(commandResult({ created: 1, errors: [] }));
	getTrenchesNearNode.mockResolvedValue(nearby);
	getTrenchSelections.mockResolvedValue([]);
});

afterEach(() => {
	getConnections.mockReset();
	createConnections.mockReset();
	getTrenchesNearNode.mockReset();
	getTrenchSelections.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('PipeBranchCanvas', () => {
	test('should start with an empty, locked canvas and the panel on the page without a node', async () => {
		renderCanvas();

		expect(await screen.findByText('panel for proj-1')).toBeInTheDocument();
		expect(within(screen.getByRole('list', { name: 'nodes' })).queryAllByRole('listitem')).toEqual(
			[]
		);
		expect(screen.getByTestId('svelte-flow')).toHaveAttribute('data-connectable', 'false');
		expect(getConnections).not.toHaveBeenCalled();
	});

	test('should open on the conduits saved for the node named in the URL', async () => {
		getTrenchSelections.mockResolvedValue(['t2']);
		renderCanvas(nodeA);

		const nodes = within(await screen.findByRole('list', { name: 'nodes' }));
		await nodes.findByText('trench-t2-conduit-c2');
		expect(nodes.getAllByRole('listitem').map((node) => node.textContent)).toEqual([
			'trench-t1-conduit-c1',
			'trench-t2-conduit-c2',
			'trench-t2-conduit-c3'
		]);
		expect(getTrenchesNearNode).toHaveBeenCalledWith({ nodeName: 'Node A', projectId: 'proj-1' });
		expect(screen.getByText('panel for proj-1')).toBeInTheDocument();
	});

	test('should draw a node per selected conduit and the saved connections of the node', async () => {
		renderCanvas(nodeA);

		await loadSelection();

		const nodes = within(screen.getByRole('list', { name: 'nodes' })).getAllByRole('listitem');
		expect(nodes.map((node) => node.textContent)).toEqual([
			'trench-t1-conduit-c1',
			'trench-t2-conduit-c2',
			'trench-t2-conduit-c3'
		]);
		expect(getConnections).toHaveBeenCalledWith('node-a');
		expect(
			within(screen.getByRole('list', { name: 'edges' })).getByText('connection-conn-1')
		).toBeInTheDocument();
	});

	test('should save a connection dragged between two microducts instead of adding its own edge', async () => {
		renderCanvas(nodeA);
		await loadSelection();

		await user.click(screen.getByRole('button', { name: 'drag m2 to m3' }));

		expect(createConnections).toHaveBeenCalledExactlyOnceWith({
			nodeUuid: 'node-a',
			pairs: [
				{
					from: { microductUuid: 'm2', trenchUuid: 't1' },
					to: { microductUuid: 'm3', trenchUuid: 't2' }
				}
			]
		});
		expect(screen.getByText('own edge: declined')).toBeInTheDocument();
	});

	test('should refuse a connection that starts at a target handle', async () => {
		renderCanvas(nodeA);
		await loadSelection();

		await user.click(screen.getByRole('button', { name: 'drag from a target handle' }));

		expect(createConnections).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'message_error_cannot_connect_from_source' })
		);
	});

	test('should refuse to connect a microduct to itself', async () => {
		renderCanvas(nodeA);
		await loadSelection();

		await user.click(screen.getByRole('button', { name: 'drag m2 onto itself' }));

		expect(createConnections).not.toHaveBeenCalled();
		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'message_error_cannot_connect_microduct_to_itself' })
		);
	});

	test('should open the trench selector for a node without a saved selection', async () => {
		getTrenchesNearNode.mockResolvedValue({ ...nearby, trenches: [], count: 0 });
		getConnections.mockImplementation(() => queryResult<BranchConnection[]>([]));
		renderCanvas(nodeA);

		expect(await screen.findByText('message_no_trenches_near_node')).toBeInTheDocument();
		expect(screen.queryByText('panel for proj-1')).not.toBeInTheDocument();
		expect(getTrenchesNearNode).toHaveBeenCalledWith({ nodeName: 'Node A', projectId: 'proj-1' });
	});

	test('should fail the boundary when the trenches of the node cannot be loaded', async () => {
		getTrenchesNearNode.mockRejectedValue(httpError(404, 'Node not found'));
		renderCanvas(nodeA);

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});

	test('should lay the lasso over the canvas only while lasso mode is on', async () => {
		renderCanvas();

		expect(screen.queryByTestId('pipe-branch-lasso')).not.toBeInTheDocument();

		await user.click(await screen.findByRole('button', { name: 'lasso on' }));

		expect(await screen.findByTestId('pipe-branch-lasso')).toBeInTheDocument();
	});

	test('should replace the canvas with a retry when the connections cannot be loaded', async () => {
		getConnections.mockImplementation(() => Promise.reject(httpError(502, 'Backend unavailable')));
		renderCanvas(nodeA);

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
