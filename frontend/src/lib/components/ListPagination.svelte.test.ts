import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import ListPagination from './ListPagination.svelte';

const gotoMock = vi.fn();

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => gotoMock(...args)
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/address/1?search=haupt&page=5') }
}));

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

const defaultMatchMedia = window.matchMedia;

/**
 * Makes every `max-width` media query match, emulating a phone viewport.
 */
function emulatePhoneViewport() {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: query.includes('max-width'),
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}));
}

/**
 * Returns the visible page numbers in render order.
 */
function pageNumbers() {
	return Array.from(document.querySelectorAll('[data-part="item"]')).map((el) =>
		el.textContent?.trim()
	);
}

describe('ListPagination', () => {
	afterEach(() => {
		window.matchMedia = defaultMatchMedia;
		gotoMock.mockClear();
	});

	test('shows the neighbouring pages of the current page on wide screens', () => {
		render(ListPagination, { totalCount: 900, pageSize: 50, page: 5 });

		expect(pageNumbers()).toEqual(['1', '4', '5', '6', '18']);
	});

	test('drops the neighbouring pages on phone screens so the bar fits', () => {
		emulatePhoneViewport();
		render(ListPagination, { totalCount: 900, pageSize: 50, page: 5 });

		expect(pageNumbers()).toEqual(['1', '5', '18']);
	});

	test('renders the total result count', () => {
		render(ListPagination, { totalCount: 137, pageSize: 50, page: 1 });

		expect(screen.getByTestId('pagination-count').textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'137 common_results:137'
		);
	});

	test('opens the next page while keeping the other query params', async () => {
		const user = userEvent.setup();
		render(ListPagination, { totalCount: 900, pageSize: 50, page: 5 });

		await user.click(screen.getByRole('button', { name: 'next page' }));

		expect(gotoMock).toHaveBeenCalledWith('/address/1?search=haupt&page=6', {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	});
});
