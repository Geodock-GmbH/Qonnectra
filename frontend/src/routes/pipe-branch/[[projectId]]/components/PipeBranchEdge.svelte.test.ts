import type { BranchEdgeData } from './branchGraph';
import type { BranchConnection } from '$lib/remote/pipe-branch/connection-data';
import type { OverrideStub } from '$lib/test-utils/remote-stubs';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { globalToaster } from '$lib/stores/toaster';
import {
	commandFailure,
	commandResult,
	httpError,
	queryResult
} from '$lib/test-utils/remote-stubs';

import PipeBranchEdge from './PipeBranchEdge.svelte';
import PipeBranchStateFixture from './PipeBranchState.fixture.svelte';
import { PipeBranchState } from './PipeBranchState.svelte';

const getConnections = vi.fn();
const deleteConnection = vi.fn();

vi.mock('$lib/remote/pipe-branch/connections.remote', () => ({
	getConnections: (...args: unknown[]) => getConnections(...args),
	deleteConnection: (...args: unknown[]) => deleteConnection(...args)
}));

vi.mock('@xyflow/svelte', async () => {
	const { default: BaseEdge } = await import('$lib/test-utils/mocks/BaseEdge.svelte');
	return { BaseEdge, getStraightPath: () => ['M0 0L10 10'] };
});

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
const other: BranchConnection = {
	uuid: 'conn-2',
	from: { microductUuid: 'm2', trenchUuid: 't1' },
	to: { microductUuid: 'm4', trenchUuid: 't2' }
};

const user = userEvent.setup();

function renderEdge(uuid: string | null) {
	const branch = new PipeBranchState('proj-1');
	branch.showOnCanvas('node-a', []);
	const data: BranchEdgeData = {
		uuid,
		sourceHandleData: {
			microductUuid: 'm1',
			microductNumber: 1,
			conduitName: 'Conduit 1',
			conduitUuid: 'c1'
		},
		targetHandleData: {
			microductUuid: 'm3',
			microductNumber: 7,
			conduitName: 'Conduit 2',
			conduitUuid: 'c2'
		}
	};
	render(PipeBranchStateFixture, {
		props: {
			component: PipeBranchEdge,
			props: { id: 'edge-1', sourceX: 0, sourceY: 0, targetX: 100, targetY: 100, data },
			branch
		}
	});
}

beforeEach(() => {
	getConnections.mockReturnValue(queryResult<BranchConnection[]>([saved, other]));
	deleteConnection.mockReturnValue(commandResult(undefined));
});

afterEach(() => {
	getConnections.mockReset();
	deleteConnection.mockReset();
	vi.mocked(globalToaster.success).mockClear();
	vi.mocked(globalToaster.error).mockClear();
});

describe('PipeBranchEdge', () => {
	test('should label a saved connection with both microduct numbers', () => {
		renderEdge('conn-1');

		expect(screen.getByText('1 ↔ 7')).toBeInTheDocument();
	});

	test('should offer no delete while the connection is still being saved', () => {
		renderEdge(null);

		expect(screen.getByTestId('base-edge')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: 'tooltip_delete_connection' })
		).not.toBeInTheDocument();
	});

	test('should delete the connection at its node', async () => {
		renderEdge('conn-1');

		await user.click(screen.getByRole('button', { name: 'tooltip_delete_connection' }));

		expect(deleteConnection).toHaveBeenCalledExactlyOnceWith({
			uuid: 'conn-1',
			nodeUuid: 'node-a'
		});
		expect(globalToaster.success).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'message_connection_deleted_successfully' })
		);
	});

	test('should take the connection off the canvas while the delete is in flight', async () => {
		const updates: unknown[] = [];
		deleteConnection.mockReturnValue(
			commandResult(undefined, (...handed) => updates.push(...handed))
		);
		renderEdge('conn-1');

		await user.click(screen.getByRole('button', { name: 'tooltip_delete_connection' }));

		expect(getConnections).toHaveBeenCalledWith('node-a');
		const [override] = updates as Array<OverrideStub<BranchConnection[]>>;
		expect(override.update([saved, other])).toEqual([other]);
	});

	test('should show why the backend refused the delete', async () => {
		deleteConnection.mockReturnValue(commandFailure(httpError(409, 'Connection is in use')));
		renderEdge('conn-1');

		await user.click(screen.getByRole('button', { name: 'tooltip_delete_connection' }));

		expect(globalToaster.error).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ description: 'Connection is in use' })
		);
		expect(globalToaster.success).not.toHaveBeenCalled();
	});
});
