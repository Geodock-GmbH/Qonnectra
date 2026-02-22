/**
 * WMS token heartbeat utility for keeping WMS access tokens fresh.
 * Refreshes the short-lived WMS token periodically and updates layer URLs.
 */

import { fetchWMSAccessToken } from './wmsApi.js';

const WMS_TOKEN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes (token expires in 5)

let heartbeatInterval = $state(null);
let currentToken = $state(null);
let onTokenRefresh = null;

/**
 * Fetches a new WMS token and notifies the callback.
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
 * Starts the WMS token refresh heartbeat.
 * @param {Function} updateLayersCallback - Called with the new token when refreshed
 * @param {string} [initialToken] - Initial token to store (optional)
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
 * Stops the WMS token refresh heartbeat.
 */
export function stopWMSHeartbeat() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
	onTokenRefresh = null;
}

/**
 * Returns the current WMS token.
 * @returns {string|null}
 */
export function getCurrentWMSToken() {
	return currentToken;
}
