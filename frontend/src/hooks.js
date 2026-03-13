import { deLocalizeUrl } from '$lib/paraglide/runtime';

/**
 * Reroutes requests by stripping the locale prefix from the URL pathname.
 * @param {{ url: URL }} request - The incoming request event.
 * @returns {string} The de-localized pathname.
 */
export const reroute = (request) => {
	return deLocalizeUrl(request.url).pathname;
};
