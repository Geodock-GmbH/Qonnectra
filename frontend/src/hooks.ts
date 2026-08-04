import type { Reroute } from '@sveltejs/kit';

import { deLocalizeUrl } from '$lib/paraglide/runtime';

/**
 * Reroutes requests by stripping the locale prefix from the URL pathname.
 */
export const reroute: Reroute = (request) => {
	return deLocalizeUrl(request.url).pathname;
};
