/**
 * Token heartbeat utility for keeping JWT tokens fresh.
 * Calls /api/refresh periodically to prevent token expiration
 * when the user stays on a single page (like the map) without navigation.
 */

const HEARTBEAT_INTERVAL_MS = 7 * 60 * 1000;
const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const SAFETY_MARGIN_MS = 60 * 1000;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatInterval = $state(null);

/** @type {number | null} */
let lastRefreshTime = $state(null);

/**
 * Performs a token refresh request and updates the last refresh timestamp.
 * Redirects to login if the refresh token is missing or invalid.
 * @returns {Promise<boolean>} Whether the refresh succeeded.
 */
async function refreshToken() {
	try {
		const response = await fetch('/api/refresh', {
			method: 'POST',
			credentials: 'include'
		});

		if (!response.ok) {
			const data = await response.json();
			if (data.reason === 'no_refresh_token' || data.reason === 'refresh_failed') {
				stopHeartbeat();
				window.location.href = '/login';
				return false;
			}
		}

		lastRefreshTime = Date.now();
		return true;
	} catch (error) {
		console.error('Token refresh failed:', error);
		return false;
	}
}

/**
 * Checks whether the access token might expire before the next scheduled heartbeat.
 * @returns {boolean} Whether an immediate refresh is needed.
 */
function needsImmediateRefresh() {
	if (!lastRefreshTime) return true;

	const timeSinceRefresh = Date.now() - lastRefreshTime;
	const timeUntilExpiry = ACCESS_TOKEN_LIFETIME_MS - timeSinceRefresh;

	return timeUntilExpiry < HEARTBEAT_INTERVAL_MS + SAFETY_MARGIN_MS;
}

/**
 * Starts the token refresh heartbeat interval.
 * Safe to call multiple times — will not create duplicate intervals.
 * Performs an immediate refresh if the token might expire before the first tick.
 * @returns {Promise<void>}
 */
export async function startHeartbeat() {
	if (heartbeatInterval) return;

	if (needsImmediateRefresh()) {
		await refreshToken();
	}

	heartbeatInterval = setInterval(refreshToken, HEARTBEAT_INTERVAL_MS);
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
