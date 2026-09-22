/**
 * A stand-in for `page` from `$app/state` in component tests: the fields the
 * navigation and route-aware components read, with sensible defaults.
 * @param options - The route id, params, URL and page data to expose.
 * @returns A plain object shaped like `page`.
 */
export function pageStub({
	routeId = null,
	params = {},
	url = 'http://localhost/',
	data = {}
}: {
	routeId?: string | null;
	params?: Record<string, string>;
	url?: string;
	data?: Record<string, unknown>;
} = {}) {
	return {
		route: { id: routeId },
		params,
		url: new URL(url),
		data,
		status: 200,
		error: null,
		form: null,
		state: {}
	};
}
