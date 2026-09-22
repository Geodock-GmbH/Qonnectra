import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import PostCompactionWorkspace from './PostCompactionWorkspace.svelte';

const { pageState, gotoMock } = vi.hoisted(() => ({
	pageState: {
		url: new URL('http://localhost/project/7/post-compaction'),
		params: { projectId: '7' }
	},
	gotoMock: vi.fn()
}));

vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => gotoMock(...args) }));

vi.mock('./AddressSearch.svelte', async () => ({
	default: (await import('./AddressSearchStub.fixture.svelte')).default
}));

vi.mock('./SelectedAddress.svelte', async () => ({
	default: (await import('./SelectedAddressStub.fixture.svelte')).default
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy({}, { get: (_target, prop: string) => () => `${prop}` })
}));

const user = userEvent.setup();

beforeEach(() => {
	pageState.url = new URL('http://localhost/project/7/post-compaction');
	gotoMock.mockReset();
});

describe('PostCompactionWorkspace', () => {
	test('should show the search while the URL names no address', () => {
		render(PostCompactionWorkspace, { projectId: '7' });

		expect(screen.getByTestId('address-search')).toHaveTextContent('search in 7');
		expect(screen.queryByTestId('selected-address')).not.toBeInTheDocument();
	});

	test('should open a picked address as a place in the URL', async () => {
		render(PostCompactionWorkspace, { projectId: '7' });

		await user.click(screen.getByRole('button', { name: 'pick addr-1' }));

		expect(gotoMock).toHaveBeenCalledWith('/project/7/post-compaction?address=addr-1', {
			keepFocus: true,
			noScroll: true,
			replaceState: false
		});
	});

	test('should show the address the URL names', () => {
		pageState.url = new URL('http://localhost/project/7/post-compaction?address=addr-9');

		render(PostCompactionWorkspace, { projectId: '7' });

		expect(screen.getByTestId('selected-address')).toHaveTextContent('address addr-9');
	});

	test('should return to the search by rewriting the entry when cleared', async () => {
		pageState.url = new URL('http://localhost/project/7/post-compaction?address=addr-9');
		render(PostCompactionWorkspace, { projectId: '7' });

		await user.click(screen.getByRole('button', { name: 'clear' }));

		expect(gotoMock).toHaveBeenCalledWith('/project/7/post-compaction', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});

	test('should treat a malformed address as none', () => {
		pageState.url = new URL('http://localhost/project/7/post-compaction?address=not%20a%20uuid');

		render(PostCompactionWorkspace, { projectId: '7' });

		expect(screen.getByTestId('address-search')).toBeInTheDocument();
	});
});
