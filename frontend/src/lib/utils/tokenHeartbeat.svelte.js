/**
 * Token heartbeat utility for keeping JWT tokens fresh.
 * Triggers SvelteKit load functions periodically so the server-side auth hooks
 * can refresh tokens when the user stays on a single page without navigation.
 */

import { invalidateAll } from '$app/navigation';

const HEARTBEAT_INTERVAL_MS = 7 * 60 * 1000;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatInterval = $state(null);

/**
 * Starts the token refresh heartbeat interval.
 * Triggers an immediate refresh on start so tokens are validated right away
 * (e.g. after a page reload that resets the timer).
 * Safe to call multiple times — will not create duplicate intervals.
 * @returns {void}
 */
export function startHeartbeat() {
	if (heartbeatInterval) return;

	invalidateAll();
	heartbeatInterval = setInterval(() => invalidateAll(), HEARTBEAT_INTERVAL_MS);
}

/**
 * Stops the token refresh heartbeat interval.
 * Safe to call multiple times.
 * @returns {void}
 */
export function stopHeartbeat() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
}
