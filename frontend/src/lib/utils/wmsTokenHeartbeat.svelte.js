/**
 * WMS token heartbeat utility for keeping WMS access tokens fresh.
 * Refreshes the short-lived WMS token periodically and updates layer URLs.
 */

import { fetchWMSAccessToken } from './wmsApi.js';

const WMS_TOKEN_INTERVAL_MS = 3 * 60 * 1000;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatInterval = $state(null);

/** @type {string | null} */
let currentToken = $state(null);

/** @type {((token: string) => void) | null} */
let onTokenRefresh = null;

/**
 * Fetches a new WMS token and notifies the registered callback.
 * @returns {Promise<void>}
 */
async function refreshWMSToken() {
	try {
		const token = await fetchWMSAccessToken();
		currentToken = token;
		onTokenRefresh?.(token);
	} catch (error) {
		console.error('WMS token refresh failed:', error);
	}
}

/**
 * Starts the WMS token refresh heartbeat interval.
 * Safe to call multiple times — will not create duplicate intervals.
 * @param {(token: string) => void} updateLayersCallback - Called with the new token on each refresh.
 * @param {string} [initialToken] - Initial token to store without triggering a refresh.
 * @returns {void}
 */
export function startWMSHeartbeat(updateLayersCallback, initialToken) {
	if (heartbeatInterval) return;

	onTokenRefresh = updateLayersCallback;
	if (initialToken) {
		currentToken = initialToken;
	}

	heartbeatInterval = setInterval(refreshWMSToken, WMS_TOKEN_INTERVAL_MS);
}

/**
 * Stops the WMS token refresh heartbeat and clears the callback.
 * @returns {void}
 */
export function stopWMSHeartbeat() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
	onTokenRefresh = null;
}

/**
 * Returns the current WMS access token.
 * @returns {string | null} The token, or null if not yet fetched.
 */
export function getCurrentWMSToken() {
	return currentToken;
}
