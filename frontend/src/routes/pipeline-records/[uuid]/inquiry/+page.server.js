import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Validates the parent pipeline record exists.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ fetch, cookies, params }) {
	const headers = getAuthHeaders(cookies);
	const { uuid } = params;

	const response = await fetch(`${API_URL}pipeline-records/${uuid}/`, {
		credentials: 'include',
		headers
	});

	return {
		recordExists: response.ok
	};
}
