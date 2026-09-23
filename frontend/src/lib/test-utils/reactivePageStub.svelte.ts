import { vi } from 'vitest';

import { pageStub } from './pageStub';

/**
 * A reactive stand-in for `page` from `$app/state`, for tests of components
 * that read the URL after a navigation stub moved it: reassigning its `url`
 * re-renders whatever derived from it. Same defaults as `pageStub`.
 * @param options - The route id, params, URL and page data to expose.
 * @returns A reactive object shaped like `page`.
 */
export function reactivePageStub(options: Parameters<typeof pageStub>[0] = {}) {
	const page = $state(pageStub(options));
	return page;
}

/** The shape of a `reactivePageStub`, for tests that move the mocked `page`. */
export type ReactivePage = ReturnType<typeof reactivePageStub>;

/**
 * A `goto` stand-in that moves a page stub to the target, so a component
 * that navigates through the URL re-renders as it would in the browser.
 * Like SvelteKit, the navigation sets `page.state` to its `state` option,
 * or clears it. The tests assert on its calls and can navigate through it
 * themselves.
 * @param page - The page stub to move, normally a `reactivePageStub`.
 * @returns A mock resolving once the URL has been replaced.
 */
export function gotoStub(page: { url: URL; state: App.PageState }) {
	return vi.fn((href: string, options: { state?: App.PageState } = {}) => {
		page.url = new URL(href, page.url);
		page.state = options.state ?? {};
		return Promise.resolve();
	});
}

/**
 * A `replaceState` stand-in that sets a page stub's history state, and its
 * URL unless the target is `''` (the current URL), as shallow routing does.
 * @param page - The page stub to update, normally a `reactivePageStub`.
 * @returns A mock of `replaceState`.
 */
export function replaceStateStub(page: { url: URL; state: App.PageState }) {
	return vi.fn((href: string | URL, state: App.PageState) => {
		if (href !== '') page.url = new URL(href, page.url);
		page.state = state;
	});
}
