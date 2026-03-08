import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Fetch all cables that pass through a trench
 * @param {typeof fetch} fetch - SvelteKit fetch
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies
 * @param {string} trenchUuid - UUID of the trench
 * @returns {Promise<Object>} The cables data or failure response
 */
export async function getCablesInTrench(fetch, cookies, trenchUuid) {
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
