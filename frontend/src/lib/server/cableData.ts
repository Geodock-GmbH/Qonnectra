import type { ActionFailure, Cookies } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** Fetch all cables that pass through a trench */
export async function getCablesInTrench(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	trenchUuid: string
): Promise<Record<string, unknown> | ActionFailure<{ error: string }>> {
	if (!trenchUuid) {
		return fail(400, { error: 'Trench UUID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const backendUrl = `${API_URL}cable/in-trench/${trenchUuid}/`;

		const response = await fetch(backendUrl, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to get cables in trench' });
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error getting cables in trench:', error);
		return fail(500, { error: 'Internal server error' });
	}
}
