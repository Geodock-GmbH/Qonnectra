import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

import Page from './+page.svelte';
import { page } from './components/pageState.fixture.svelte';

vi.mock('$app/state', async () => await import('./components/pageState.fixture.svelte'));

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
});

describe('/pipe-branch/+page.svelte', () => {
	test('should open the canvas for the project in the URL', async () => {
		page.params.projectId = 'proj-1';

		render(Page);

		expect(await screen.findByTestId('pipe-branch-canvas')).toHaveTextContent('canvas for proj-1');
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
});
