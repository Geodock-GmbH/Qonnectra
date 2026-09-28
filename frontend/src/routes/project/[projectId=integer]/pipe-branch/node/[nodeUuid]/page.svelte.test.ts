import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { page } from '../../components/pageState.fixture.svelte';
import Page from './+page.svelte';

const { getPipeBranches } = vi.hoisted(() => ({ getPipeBranches: vi.fn() }));

vi.mock('$app/state', async () => await import('../../components/pageState.fixture.svelte'));

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
	page.params = { projectId: 'proj-1', nodeUuid: 'uuid-a' };
	getPipeBranches.mockResolvedValue({
		branches: [
			{ label: 'Node A', value: 'Node A', uuid: 'uuid-a' },
			{ label: 'Node B', value: 'Node B', uuid: 'uuid-b' }
		],
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

	test('should start a fresh canvas for the node picked next', async () => {
		render(Page);
		const first = (await screen.findByTestId('pipe-branch-canvas')).dataset.instance;

		page.params.nodeUuid = 'uuid-b';

		await vi.waitFor(() =>
			expect(screen.getByTestId('pipe-branch-canvas')).toHaveTextContent(
				'canvas for proj-1 / Node B'
			)
		);
		expect(screen.getByTestId('pipe-branch-canvas').dataset.instance).not.toBe(first);
	});

	test('should show the error state for a node the project does not have', async () => {
		page.params.nodeUuid = 'uuid-unknown';
		render(Page);

		expect(await screen.findByRole('alert')).toHaveTextContent('message_pipe_branch_not_found');
		expect(screen.queryByTestId('pipe-branch-canvas')).not.toBeInTheDocument();
	});
});
