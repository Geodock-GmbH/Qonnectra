/**
 * WMS token heartbeat utility for keeping WMS access tokens fresh.
 * Refreshes the short-lived WMS token periodically and updates layer URLs.
 */

import { fetchWMSAccessToken } from './wmsApi';

const WMS_TOKEN_INTERVAL_MS = 3 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

let heartbeatInterval: ReturnType<typeof setInterval> | null = $state(null);
let currentToken: string | null = $state(null);
let onTokenRefresh: ((token: string) => void) | null = null;
let onAuthFailure: (() => void) | null = null;
let consecutiveFailures = 0;
let immediateRefresh: Promise<void> | null = null;
let lastImmediateRefreshAt = 0;

const IMMEDIATE_REFRESH_COOLDOWN_MS = 30 * 1000;

/**
 * Fetches a new WMS token and notifies the registered callback.
 * Stops the heartbeat on persistent auth failures (401/403).
 */
async function refreshWMSToken(): Promise<void> {
	try {
		const token = await fetchWMSAccessToken();
		currentToken = token;
		consecutiveFailures = 0;
		onTokenRefresh?.(token);
	} catch (error) {
		const status = (error as { status?: number })?.status;

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
 * Safe to call multiple times -- will not create duplicate intervals.
 */
export function startWMSHeartbeat(
	updateLayersCallback: (token: string) => void,
	initialToken?: string,
	authFailureCallback?: () => void
): void {
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
 */
export function stopWMSHeartbeat(): void {
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
 */
export function requestImmediateWMSRefresh(force = false): void {
	if (!heartbeatInterval) return;
	if (immediateRefresh) return;
	if (!force && Date.now() - lastImmediateRefreshAt < IMMEDIATE_REFRESH_COOLDOWN_MS) return;

	lastImmediateRefreshAt = Date.now();
	immediateRefresh = refreshWMSToken().finally(() => {
		immediateRefresh = null;
	});
}

/** Returns the current WMS access token, or null if not yet fetched. */
export function getCurrentWMSToken(): string | null {
	return currentToken;
}

/** Returns whether the WMS heartbeat is currently running. */
export function isWMSHeartbeatRunning(): boolean {
	return heartbeatInterval !== null;
}
