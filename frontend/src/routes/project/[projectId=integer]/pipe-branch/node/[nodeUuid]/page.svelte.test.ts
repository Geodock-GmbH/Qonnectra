import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';

const { pageState, getPipeBranches } = vi.hoisted(() => ({
	pageState: { params: { projectId: 'proj-1', nodeUuid: 'uuid-a' } as Record<string, string> },
	getPipeBranches: vi.fn()
}));

vi.mock('$app/state', () => ({ page: pageState }));

vi.mock('$lib/remote/pipe-branch/branches.remote', () => ({
	getPipeBranches: (...args: unknown[]) => getPipeBranches(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

vi.mock('../../components/PipeBranchCanvas.svelte', async () => {
	const { default: PipeBranchCanvasStub } =
		await import('../../components/PipeBranchCanvasStub.fixture.svelte');
	return { default: PipeBranchCanvasStub };
});

beforeEach(() => {
	pageState.params = { projectId: 'proj-1', nodeUuid: 'uuid-a' };
	getPipeBranches.mockResolvedValue({
		branches: [{ label: 'Node A', value: 'Node A', uuid: 'uuid-a' }],
		configured: true
	});
});

afterEach(() => {
	getPipeBranches.mockReset();
});

describe('/pipe-branch/node/[nodeUuid]/+page.svelte', () => {
	test('should open the canvas for the node named in the URL', async () => {
		render(Page);

		expect(await screen.findByTestId('pipe-branch-canvas')).toHaveTextContent(
			'canvas for proj-1 / Node A'
		);
		expect(getPipeBranches).toHaveBeenCalledWith('proj-1');
	});

	test('should show the error state for a node the project does not have', async () => {
		pageState.params.nodeUuid = 'uuid-unknown';
		render(Page);

		expect(await screen.findByRole('alert')).toHaveTextContent('message_pipe_branch_not_found');
		expect(screen.queryByTestId('pipe-branch-canvas')).not.toBeInTheDocument();
	});
});
