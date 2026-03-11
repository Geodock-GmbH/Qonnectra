import { json } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * GET /api/residential-unit/[unitUuid]/fiber-connections
 * Fetch fiber connections for a residential unit.
 */
export async function GET({ cookies, fetch, params }) {
	const headers = getAuthHeaders(cookies);
	const { unitUuid } = params;

	try {
		const response = await fetch(`${API_URL}residential-unit/${unitUuid}/fiber-connections/`, {
			credentials: 'include',
			headers
		});

		if (!response.ok) {
			return json([], { status: response.status });
		}

		const data = await response.json();
		return json(data);
	} catch (error) {
		console.error('Error fetching fiber connections:', error);
		return json([], { status: 500 });
	}
}
