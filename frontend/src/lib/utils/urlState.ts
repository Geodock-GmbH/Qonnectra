import { afterNavigate, goto } from '$app/navigation';
import { page } from '$app/state';

/**
 * Query-string state shared by every page that keeps state in the URL.
 *
 * Reserved parameter names, which no page may reuse for something else:
 * - `feature`: the drawer feature as `kind:uuid`
 * - `tab`: the active tab of the page or drawer
 * - `search`: the free-text search term
 * - `page`: 1-based page number, default 1
 * - `page_size`: rows per page, default 50
 *
 * Page-specific schemas (one pure "URL → typed request" function per page)
 * are built from the readers below and live next to their feature.
 */

/** Rows per page when the URL names none. */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Values a reserved parameter has when it is absent. Writing such a value
 * deletes the parameter instead, so `?page=1` never appears in a URL.
 */
export const QUERY_DEFAULTS: Readonly<Record<string, string>> = {
	page: '1',
	page_size: String(DEFAULT_PAGE_SIZE)
};

/** Parameters to set; `null`, `undefined` and `''` delete the key. */
export type QueryChanges = Record<string, string | number | null | undefined>;

/**
 * Applies changes to a URL's query string. Unrelated parameters and the hash
 * are preserved (the hash carries the map view), and existing keys keep
 * their position so URLs stay stable and comparable.
 * @param url - The URL to start from, normally `page.url`.
 * @param changes - Parameters to set or delete.
 * @returns The path, query and hash of the resulting URL.
 */
export function withParams(url: URL, changes: QueryChanges): string {
	const params = new URLSearchParams(url.searchParams);
	for (const [key, value] of Object.entries(changes)) {
		const text = value === null || value === undefined ? '' : String(value);
		if (text === '' || text === QUERY_DEFAULTS[key]) {
			params.delete(key);
		} else {
			params.set(key, text);
		}
	}
	const search = params.toString();
	return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}

/**
 * Navigates to the current page with changed query parameters. Focus and
 * scroll position are kept, and an adjustment (tab, filter, page number)
 * rewrites the current history entry; pass `push` for a place the back
 * button should return from (opening a feature, switching a mode). The path
 * is the already-resolved current path, so no `resolve()` is involved.
 * Reads `page` at call time, which is fine in event handlers but not at
 * module scope.
 * @param changes - Parameters to set or delete.
 * @param options - `push` adds a history entry instead of replacing it;
 *   `state` becomes `page.state` in the same navigation (a navigation
 *   without it clears `page.state`).
 * @returns Resolves once the navigation has completed.
 */
export function setQuery(
	changes: QueryChanges,
	{ push = false, state }: { push?: boolean; state?: App.PageState } = {}
) {
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-page navigation: the path is the already-resolved current path
	return goto(withParams(page.url, changes), {
		keepFocus: true,
		noScroll: true,
		replaceState: !push,
		...(state && { state })
	});
}

/**
 * Reads a string parameter.
 * @param url - The page URL.
 * @param key - Parameter name.
 * @param fallback - Value when the parameter is missing or empty.
 * @returns The parameter's value, or the fallback.
 */
export function queryString(url: URL, key: string, fallback = ''): string {
	return url.searchParams.get(key) || fallback;
}

/**
 * Reads an integer parameter, clamped to an optional range. Anything that is
 * not a whole number (missing, empty, `abc`, `1.5`) yields the fallback.
 * @param url - The page URL.
 * @param key - Parameter name.
 * @param fallback - Value when the parameter is missing or malformed.
 * @param range - Inclusive bounds the value is clamped to.
 * @returns The parsed integer, clamped, or the fallback.
 */
export function queryInt(
	url: URL,
	key: string,
	fallback: number,
	{ min, max }: { min?: number; max?: number } = {}
): number {
	const raw = url.searchParams.get(key);
	if (raw === null || raw.trim() === '') return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value)) return fallback;
	if (min !== undefined && value < min) return min;
	if (max !== undefined && value > max) return max;
	return value;
}

/**
 * Reads a parameter that must be one of a fixed set of values.
 * @param url - The page URL.
 * @param key - Parameter name.
 * @param allowed - The accepted values.
 * @param fallback - Value when the parameter is missing or not accepted.
 * @returns The matching allowed value, or the fallback.
 */
export function queryEnum<T extends string>(
	url: URL,
	key: string,
	allowed: readonly T[],
	fallback: T
): T {
	const raw = url.searchParams.get(key);
	return allowed.find((value) => value === raw) ?? fallback;
}

/**
 * Reads a comma-separated list parameter. Blank entries are dropped.
 * @param url - The page URL.
 * @param key - Parameter name.
 * @returns The entries, or an empty list when the parameter is missing.
 */
export function queryList(url: URL, key: string): string[] {
	const raw = url.searchParams.get(key);
	if (!raw) return [];
	return raw
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
}

/** The drawer feature named in the URL: its kind and identifier. */
export interface UrlFeature<K extends string = string> {
	kind: K;
	id: string;
}

/** Identifiers are uuids or numeric ids; anything else is treated as absent. */
const FEATURE_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Reads the drawer feature from `?feature=kind:id`. The drawer is open
 * exactly when this returns a feature. A kind outside the page's allow-list
 * or a malformed id counts as absent, so a stray URL closes the drawer
 * instead of erroring.
 * @param url - The page URL.
 * @param kinds - The feature kinds the page can show.
 * @returns The feature, or null when the drawer is closed.
 */
export function queryFeature<K extends string>(
	url: URL,
	kinds: readonly K[]
): UrlFeature<K> | null {
	const raw = url.searchParams.get('feature');
	if (!raw) return null;
	const separator = raw.indexOf(':');
	if (separator === -1) return null;
	const kind = kinds.find((candidate) => candidate === raw.slice(0, separator));
	const id = raw.slice(separator + 1);
	if (!kind || !FEATURE_ID.test(id)) return null;
	return { kind, id };
}

/**
 * Builds the `feature` parameter value for a feature.
 * @param kind - The feature kind.
 * @param id - The feature identifier.
 * @returns `kind:id`.
 */
export function featureParam(kind: string, id: string): string {
	return `${kind}:${id}`;
}

/**
 * Opens a feature in the drawer. Opening from a closed drawer is a place,
 * so it pushes a history entry and back closes the drawer; switching the
 * feature while the drawer is open replaces the entry, so back still closes
 * the drawer in one step. The drawer tab is reset with the feature.
 * @param kind - The feature kind.
 * @param id - The feature identifier.
 * @returns Resolves once the navigation has completed.
 */
export function openFeature(kind: string, id: string) {
	const isOpen = page.url.searchParams.has('feature');
	return setQuery({ feature: featureParam(kind, id), tab: null }, { push: !isOpen });
}

/**
 * Closes the drawer by rewriting the current entry without the feature, so
 * back never reopens it; after a delete that would resurrect a dead entity.
 * @returns Resolves once the navigation has completed.
 */
export function closeFeature() {
	if (!page.url.searchParams.has('feature')) return Promise.resolve();
	return setQuery({ feature: null, tab: null });
}

/**
 * Runs a callback after a navigation that changed one query parameter while
 * the calling component stayed mounted, including back and forward. For the
 * consumers that mirror URL state into something imperative (a map
 * selection, a canvas selection, a map overlay). Built on `afterNavigate`,
 * so it must be called during component initialisation; the initial page
 * load is not a change.
 * @param key - The parameter to watch.
 * @param callback - Receives the raw value the URL now carries, or null.
 */
export function onQueryChange(key: string, callback: (value: string | null) => void): void {
	afterNavigate(({ from, to }) => {
		if (!from || !to) return;
		const next = to.url.searchParams.get(key);
		if (from.url.searchParams.get(key) === next) return;
		callback(next);
	});
}

/**
 * Runs a callback after a navigation that changed the `feature` parameter:
 * opening, switching or closing the drawer.
 * @param callback - Receives the raw `feature` value the URL now carries, or null.
 */
export function onFeatureChange(callback: (feature: string | null) => void): void {
	onQueryChange('feature', callback);
}
