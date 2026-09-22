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

/**
 * A `goto` stand-in that moves a page stub to the target, so a component
 * that navigates through the URL re-renders as it would in the browser.
 * The tests assert on its calls and can navigate through it themselves.
 * @param page - The page stub to move, normally a `reactivePageStub`.
 * @returns A mock resolving once the URL has been replaced.
 */
export function gotoStub(page: { url: URL }) {
	return vi.fn((href: string) => {
		page.url = new URL(href, page.url);
		return Promise.resolve();
	});
}
