import type { HandleClientError } from '@sveltejs/kit';

import { logToBackendClient } from '$lib/utils/logToBackendClient';

/**
 * Global client-side error handler. Reports any uncaught error during
 * client-side navigation or rendering to the backend log, so it surfaces
 * in the admin/frontend log page, then leaves the console output intact
 * for local debugging.
 */
export const handleError: HandleClientError = ({ error, event, status, message }) => {
	const err = error as Error;
	console.error('Unhandled client error:', err);

	void logToBackendClient({
		level: 'ERROR',
		message: err?.message || message || 'Unhandled client error',
		path: event.url.pathname,
		extraData: {
			from: 'hooks.client.handleError',
			status,
			message,
			route: event.route?.id ?? null,
			stack: err?.stack ?? null
		}
	});

	return {
		message
	};
};
