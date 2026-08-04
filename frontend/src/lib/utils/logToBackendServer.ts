import type { Cookies } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface LogResult {
	success: boolean;
	error?: string;
}

interface LogServerOptions {
	level: LogLevel;
	message: string;
	path: string;
	extraData?: Record<string, unknown>;
	project?: string | null;
	cookies: Cookies;
}

/**
 * Sends a log entry to the backend using server-side auth headers.
 */
async function logToBackend(
	level: LogLevel,
	message: string,
	path: string,
	extraData: Record<string, unknown> = {},
	project: string | null = null,
	cookies: Cookies | null = null
): Promise<LogResult> {
	try {
		const headers = new Headers(getAuthHeaders(cookies));
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
		return { success: false, error: (error as Error).message };
	}
}

/**
 * Sends a log entry to the backend from a SvelteKit server load/action function.
 * Wraps {@link logToBackend} with a destructured options object for ergonomic use.
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
}: LogServerOptions): Promise<LogResult> {
	return logToBackend(level, message, path, extraData, project, cookies);
}
