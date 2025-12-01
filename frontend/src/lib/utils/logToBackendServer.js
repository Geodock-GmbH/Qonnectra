import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Log a message to the backend from the frontend
 * @param {string} level - Log level: 'DEBUG', 'INFO', 'WARNING', 'ERROR', or 'CRITICAL'
 * @param {string} message - The log message
 * @param {string} path - The frontend path where the log originated
 * @param {object} extraData - Additional data to include in the log
 * @param {string} project - The project ID
 * @param {Cookies} cookies - The cookies object (required for server-side logging)
 * @returns {Promise<{success: boolean, error?: string}>}
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
		const headers = getAuthHeaders(cookies);
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
		return { success: false, error: error.message };
	}
}

/**
 * Server-side function to post a log entry to the backend
 * Use this in page.server.js files to log from server-side code
 *
 * @param {Object} options - The log options
 * @param {string} options.level - Log level: 'DEBUG', 'INFO', 'WARNING', 'ERROR', or 'CRITICAL'
 * @param {string} options.message - The log message
 * @param {string} options.path - The frontend path where the log originated
 * @param {object} [options.extraData={}] - Additional data to include in the log
 * @param {string} [options.project=null] - The project ID (optional)
 * @param {Cookies} options.cookies - The cookies object from the server load function
 * @returns {Promise<{success: boolean, error?: string}>}
 *
 * @example
 * // In a page.server.js file
 * import { logToBackendServer } from '$lib/utils/logToBackendServer';
 *
 * export async function load({ cookies, url }) {
 *   try {
 *     // Your logic here
 *     const result = await someOperation();
 *
 *     // Log success
 *     await logToBackendServer({
 *       level: 'INFO',
 *       message: 'Operation completed successfully',
 *       path: url.pathname,
 *       extraData: { result },
 *       project: 'project-id', // optional
 *       cookies
 *     });
 *   } catch (error) {
 *     // Log error
 *     await logToBackendServer({
 *       level: 'ERROR',
 *       message: `Operation failed: ${error.message}`,
 *       path: url.pathname,
 *       extraData: { error: error.stack },
 *       cookies
 *     });
 *   }
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
