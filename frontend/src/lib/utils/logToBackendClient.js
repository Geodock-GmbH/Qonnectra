import { PUBLIC_API_URL } from '$env/static/public';

/**
 * @typedef {'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'} LogLevel
 */

/**
 * Sends a log entry to the backend from client-side code.
 * Use this in .svelte and .svelte.js files.
 *
 * @param {Object} options - The log options.
 * @param {LogLevel} options.level - Log severity level.
 * @param {string} options.message - The log message.
 * @param {string} [options.path] - The frontend path (defaults to window.location.pathname).
 * @param {Record<string, unknown>} [options.extraData={}] - Additional data to include.
 * @param {string | null} [options.project=null] - The project ID.
 * @returns {Promise<{ success: boolean, error?: string }>} Result indicating success or failure.
 *
 * @example
 * import { logToBackendClient } from '$lib/utils/logToBackendClient';
 *
 * await logToBackendClient({
 *   level: 'ERROR',
 *   message: `Operation failed: ${error.message}`,
 *   extraData: { stack: error.stack }
 * });
 */
export async function logToBackendClient({ level, message, path, extraData = {}, project = null }) {
	try {
		const logPath = path || (typeof window !== 'undefined' ? window.location.pathname : '/');

		const response = await fetch(`${PUBLIC_API_URL}logs/frontend/`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				level: level,
				message: message,
				path: logPath,
				extra_data: extraData,
				project: project
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Failed to log:', errorText);
			return { success: false, error: errorText };
		}

		return { success: true };
	} catch (error) {
		console.error('Error logging:', error);
		return { success: false, error: /** @type {Error} */ (error).message };
	}
}
