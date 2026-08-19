import { PUBLIC_API_URL } from '$env/static/public';

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface LogOptions {
	level: LogLevel;
	message: string;
	path?: string;
	extraData?: Record<string, unknown>;
	project?: string | null;
}

interface LogResult {
	success: boolean;
	error?: string;
}

/**
 * Sends a log entry to the backend from client-side code.
 * Use this in .svelte and .svelte.js files.
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
export async function logToBackendClient({
	level,
	message,
	path,
	extraData = {},
	project = null
}: LogOptions): Promise<LogResult> {
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
		return { success: false, error: (error as Error).message };
	}
}
