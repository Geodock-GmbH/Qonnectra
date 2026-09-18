import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';
import { page } from './components/pageState.fixture.svelte';

const stored = vi.hoisted(() => ({ project: 'proj-stored' as string | null }));

vi.mock('$app/state', async () => await import('./components/pageState.fixture.svelte'));

vi.mock('$lib/stores/store', () => ({
	selectedProject: {
		subscribe: (run: (value: string | null) => void) => {
			run(stored.project);
			return () => {};
		}
	}
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

vi.mock('./components/PipeBranchCanvas.svelte', async () => {
	const { default: PipeBranchCanvasStub } =
		await import('./components/PipeBranchCanvasStub.fixture.svelte');
	return { default: PipeBranchCanvasStub };
});

afterEach(() => {
	delete page.params.projectId;
	stored.project = 'proj-stored';
});

describe('/pipe-branch/+page.svelte', () => {
	test('should open the canvas for the project in the URL', async () => {
		page.params.projectId = 'proj-1';

		render(Page);

		expect(await screen.findByTestId('pipe-branch-canvas')).toHaveTextContent('canvas for proj-1');
	});

	test('should fall back to the selected project when the URL names none', async () => {
		render(Page);

		expect(await screen.findByTestId('pipe-branch-canvas')).toHaveTextContent(
			'canvas for proj-stored'
		);
	});

	test('should start a fresh canvas when another project is opened', async () => {
		page.params.projectId = 'proj-1';
		render(Page);
		const first = (await screen.findByTestId('pipe-branch-canvas')).dataset.instance;

		page.params.projectId = 'proj-2';

		await vi.waitFor(() =>
			expect(screen.getByTestId('pipe-branch-canvas')).toHaveTextContent('canvas for proj-2')
		);
		expect(screen.getByTestId('pipe-branch-canvas').dataset.instance).not.toBe(first);
	});

	test('should still open the canvas without any project', async () => {
		stored.project = null;

		render(Page);

		expect(await screen.findByTestId('pipe-branch-canvas')).toHaveTextContent(
			'canvas for no project'
		);
	});
});
