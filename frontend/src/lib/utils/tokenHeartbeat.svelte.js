/**
 * Token heartbeat utility for keeping JWT tokens fresh.
 * Calls /api/refresh periodically to prevent token expiration
 * when the user stays on a single page (like the map) without navigation.
 */

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let heartbeatInterval = $state(null);

/**
 * Starts the token refresh heartbeat.
 * Safe to call multiple times - will not create duplicate intervals.
 */
export function startHeartbeat() {
	if (heartbeatInterval) return;

	heartbeatInterval = setInterval(async () => {
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
				}
			}
		} catch (error) {
			console.error('Token heartbeat failed:', error);
		}
	}, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stops the token refresh heartbeat.
 * Safe to call multiple times.
 */
export function stopHeartbeat() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
}
