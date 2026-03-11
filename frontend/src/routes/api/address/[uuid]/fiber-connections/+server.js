import { json } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * GET /api/address/[uuid]/fiber-connections
 * Fetch all fiber connections for all residential units of an address in one call.
 * Returns a dict mapping unit UUID to its fiber connections array.
 */
export async function GET({ cookies, fetch, params }) {
	const headers = getAuthHeaders(cookies);
	const { uuid } = params;

	try {
		const response = await fetch(`${API_URL}address/${uuid}/fiber-connections/`, {
			credentials: 'include',
			headers
		});

		if (!response.ok) {
			return json({}, { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('Error fetching fiber connections:', error);
		return json({}, { status: 500 });
	}
}
