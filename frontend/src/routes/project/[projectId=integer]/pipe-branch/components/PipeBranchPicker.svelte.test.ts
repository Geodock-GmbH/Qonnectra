import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { httpError } from '$lib/test-utils/remote-stubs';

import PipeBranchPicker from './PipeBranchPicker.svelte';
import PipeBranchStateFixture from './PipeBranchState.fixture.svelte';
import { PipeBranchState } from './PipeBranchState.svelte';

const getPipeBranches = vi.fn();
const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

vi.mock('$lib/remote/pipe-branch/branches.remote', () => ({
	getPipeBranches: (...args: unknown[]) => getPipeBranches(...args)
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const branches = [
	{ label: 'Node A', value: 'Node A', uuid: 'uuid-a' },
	{ label: 'Node B', value: 'Node B', uuid: 'uuid-b' }
];

const user = userEvent.setup();

function renderPicker(projectId = 'proj-1', node: { uuid: string; name: string } | null = null) {
	const branch = new PipeBranchState(projectId, node);
	render(PipeBranchStateFixture, { props: { component: PipeBranchPicker, branch } });
	return branch;
}

beforeEach(() => {
	getPipeBranches.mockResolvedValue({ branches, configured: true });
});

afterEach(() => {
	getPipeBranches.mockReset();
	gotoMock.mockReset();
});

describe('PipeBranchPicker', () => {
	test('should offer the pipe branches of the project', async () => {
		renderPicker();

		await user.click(await screen.findByRole('combobox'));

		expect(getPipeBranches).toHaveBeenCalledWith('proj-1');
		expect(await screen.findByRole('option', { name: 'Node A' })).toBeInTheDocument();
		expect(screen.getByRole('option', { name: 'Node B' })).toBeInTheDocument();
	});

	test('should name the picked branch in the URL, which loads its canvas', async () => {
		renderPicker();

		await user.click(await screen.findByRole('combobox'));
		await user.click(await screen.findByRole('option', { name: 'Node B' }));

		expect(gotoMock).toHaveBeenCalledExactlyOnceWith('/project/proj-1/pipe-branch/node/uuid-b');
	});

	test('should show the node from the URL and not navigate when it is picked again', async () => {
		renderPicker('proj-1', { uuid: 'uuid-a', name: 'Node A' });

		expect(await screen.findByRole('combobox')).toHaveValue('Node A');

		await user.click(screen.getByRole('combobox'));
		await user.click(await screen.findByRole('option', { name: 'Node A' }));

		expect(gotoMock).not.toHaveBeenCalled();
	});

	test('should warn when the project has not configured its pipe-branch nodes', async () => {
		getPipeBranches.mockResolvedValue({ branches, configured: false });

		renderPicker();

		expect(await screen.findByText('message_pipe_branch_not_configured')).toBeInTheDocument();
	});

	test('should not warn for a configured project', async () => {
		renderPicker();

		await screen.findByRole('combobox');
		expect(screen.queryByText('message_pipe_branch_not_configured')).not.toBeInTheDocument();
	});

	test('should not warn when there are no branches to pick from', async () => {
		getPipeBranches.mockResolvedValue({ branches: [], configured: false });

		renderPicker();

		await screen.findByRole('combobox');
		expect(screen.queryByText('message_pipe_branch_not_configured')).not.toBeInTheDocument();
	});

	test('should not ask the backend without a project', async () => {
		renderPicker('');

		expect(await screen.findByRole('combobox')).toBeInTheDocument();
		expect(getPipeBranches).not.toHaveBeenCalled();
	});

	test('should surface a failed branch request', async () => {
		getPipeBranches.mockRejectedValue(httpError(502, 'Backend unavailable'));

		renderPicker();

		expect(await screen.findByTestId('boundary-failed')).toBeInTheDocument();
	});
});
