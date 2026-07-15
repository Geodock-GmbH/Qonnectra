/**
 * WMS token heartbeat utility for keeping WMS access tokens fresh.
 * Refreshes the short-lived WMS token periodically and updates layer URLs.
 */

import { fetchWMSAccessToken } from './wmsApi.js';

const WMS_TOKEN_INTERVAL_MS = 3 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatInterval = $state(null);

/** @type {string | null} */
let currentToken = $state(null);

/** @type {((token: string) => void) | null} */
let onTokenRefresh = null;

/** @type {(() => void) | null} */
let onAuthFailure = null;

/** @type {number} */
let consecutiveFailures = 0;

/** @type {Promise<void> | null} */
let immediateRefresh = null;

/** @type {number} */
let lastImmediateRefreshAt = 0;

const IMMEDIATE_REFRESH_COOLDOWN_MS = 30 * 1000;

/**
 * Fetches a new WMS token and notifies the registered callback.
 * Stops the heartbeat on persistent auth failures (401/403).
 * @returns {Promise<void>}
 */
async function refreshWMSToken() {
	try {
		const token = await fetchWMSAccessToken();
		currentToken = token;
		consecutiveFailures = 0;
		onTokenRefresh?.(token);
	} catch (error) {
		const status = /** @type {any} */ (error)?.status;

		if (status === 401 || status === 403) {
			console.warn('WMS token refresh stopped: authentication failed');
			const authFailureCallback = onAuthFailure;
			stopWMSHeartbeat();
			authFailureCallback?.();
			return;
		}

		consecutiveFailures++;
		console.error('WMS token refresh failed:', error);

		if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
			console.warn('WMS token refresh stopped: too many consecutive failures');
			const authFailureCallback = onAuthFailure;
			stopWMSHeartbeat();
			authFailureCallback?.();
		}
	}
}

/**
 * Starts the WMS token refresh heartbeat interval.
 * Safe to call multiple times — will not create duplicate intervals.
 * @param {(token: string) => void} updateLayersCallback - Called with the new token on each refresh.
 * @param {string} [initialToken] - Initial token to store without triggering a refresh.
 * @param {(() => void)} [authFailureCallback] - Called when heartbeat stops due to auth failure.
 * @returns {void}
 */
export function startWMSHeartbeat(updateLayersCallback, initialToken, authFailureCallback) {
	if (heartbeatInterval) {
		// Already running (e.g. project switch) — adopt the freshly minted token
		// so request-time injection uses the newest one.
		if (initialToken) {
			currentToken = initialToken;
		}
		return;
	}

	onTokenRefresh = updateLayersCallback;
	onAuthFailure = authFailureCallback || null;
	consecutiveFailures = 0;
	if (initialToken) {
		currentToken = initialToken;
	}

	heartbeatInterval = setInterval(refreshWMSToken, WMS_TOKEN_INTERVAL_MS);
}

/**
 * Stops the WMS token refresh heartbeat and clears the callback.
 * Also clears the stored token so pages that bake their own token into
 * layer URLs don't get an older module-level token injected instead.
 * @returns {void}
 */
export function stopWMSHeartbeat() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
	onTokenRefresh = null;
	onAuthFailure = null;
	consecutiveFailures = 0;
	currentToken = null;
}

/**
 * Requests an out-of-band token refresh, e.g. after a tile request got a 401
 * or the tab became visible again after the browser paused timers.
 * Collapses concurrent calls and enforces a cooldown so bursts of failing
 * tiles can't hammer the token endpoint.
 * @param {boolean} [force] - Bypass the cooldown (used when returning to the tab).
 * @returns {void}
 */
export function requestImmediateWMSRefresh(force = false) {
	if (!heartbeatInterval) return;
	if (immediateRefresh) return;
	if (!force && Date.now() - lastImmediateRefreshAt < IMMEDIATE_REFRESH_COOLDOWN_MS) return;

	lastImmediateRefreshAt = Date.now();
	immediateRefresh = refreshWMSToken().finally(() => {
		immediateRefresh = null;
	});
}

/**
 * Returns the current WMS access token.
 * @returns {string | null} The token, or null if not yet fetched.
 */
export function getCurrentWMSToken() {
	return currentToken;
}

/**
 * Returns whether the WMS heartbeat is currently running.
 * @returns {boolean}
 */
export function isWMSHeartbeatRunning() {
	return heartbeatInterval !== null;
}
