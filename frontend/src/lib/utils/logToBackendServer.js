import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * @typedef {'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'} LogLevel
 */

/**
 * Sends a log entry to the backend using server-side auth headers.
 * @param {LogLevel} level - Log severity level.
 * @param {string} message - The log message.
 * @param {string} path - The frontend path where the log originated.
 * @param {Record<string, unknown>} [extraData={}] - Additional data to include.
 * @param {string | null} [project=null] - The project ID.
 * @param {import('@sveltejs/kit').Cookies | null} [cookies=null] - SvelteKit cookies for auth.
 * @returns {Promise<{ success: boolean, error?: string }>} Result indicating success or failure.
 */
export async function logToBackend(
	level,
	message,
	path,
	extraData = {},
	project = null,
	cookies = null
) {
	try {
		const headers = /** @type {any} */ (getAuthHeaders(cookies));
		headers.append('Content-Type', 'application/json');

		const response = await fetch(`${API_URL}logs/`, {
			method: 'POST',
			credentials: 'include',
			headers,
			body: JSON.stringify({
				level: level,
				message: message,
				path: path,
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

/**
 * Sends a log entry to the backend from a SvelteKit server load/action function.
 * Wraps {@link logToBackend} with a destructured options object for ergonomic use.
 *
 * @param {Object} options - The log options.
 * @param {LogLevel} options.level - Log severity level.
 * @param {string} options.message - The log message.
 * @param {string} options.path - The frontend path where the log originated.
 * @param {Record<string, unknown>} [options.extraData={}] - Additional data to include.
 * @param {string | null} [options.project=null] - The project ID.
 * @param {import('@sveltejs/kit').Cookies} options.cookies - SvelteKit cookies for auth.
 * @returns {Promise<{ success: boolean, error?: string }>} Result indicating success or failure.
 *
 * @example
 * import { logToBackendServer } from '$lib/utils/logToBackendServer';
 *
 * export async function load({ cookies, url }) {
 *   await logToBackendServer({
 *     level: 'INFO',
 *     message: 'Page loaded',
 *     path: url.pathname,
 *     cookies
 *   });
 * }
 */
export async function logToBackendServer({
	level,
	message,
	path,
	extraData = {},
	project = null,
	cookies
}) {
	return logToBackend(level, message, path, extraData, project, cookies);
}
