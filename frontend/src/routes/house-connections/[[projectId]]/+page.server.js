import { API_URL } from '$env/static/private';
import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { fail } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	return {};
}

/** @type {import('./$types').Actions} */
export const actions = {
	getPipesInTrench: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const trenchId = formData.get('uuid');

			if (!trenchId) {
				return fail(400, { error: 'Trench ID is required' });
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}trench_conduit_connection/all/?uuid_trench=${trenchId}`;

			const response = await fetch(backendUrl, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to get pipes in trench' });
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error getting pipes in trench:', error);
			return fail(500, { error: 'Internal server error' });
		}
	}
};
