import { PUBLIC_API_URL } from '$env/static/public';

/**
 * Client-side function to log messages to the backend
 * Use this in .svelte and .svelte.js files (client-side code)
 *
 * @param {Object} options - The log options
 * @param {string} options.level - Log level: 'DEBUG', 'INFO', 'WARNING', 'ERROR', or 'CRITICAL'
 * @param {string} options.message - The log message
 * @param {string} [options.path] - The frontend path (optional, will use window.location.pathname if not provided)
 * @param {object} [options.extraData={}] - Additional data to include in the log
 * @param {string} [options.project=null] - The project ID (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 *
 * @example
 * // In a .svelte.js file or Svelte component
 * import { logToBackendClient } from '$lib/utils/logToBackendClient';
 *
 * try {
 *   const result = await someOperation();
 *   await logToBackendClient({
 *     level: 'INFO',
 *     message: 'Operation completed',
 *     extraData: { result },
 *     project: 'project-id' // optional
 *   });
 * } catch (error) {
 *   await logToBackendClient({
 *     level: 'ERROR',
 *     message: `Operation failed: ${error.message}`,
 *     extraData: { stack: error.stack }
 *   });
 * }
 */
export async function logToBackendClient({ level, message, path, extraData = {}, project = null }) {
	try {
		// Use provided path or get from window location
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
		return { success: false, error: error.message };
	}
}
