import { API_URL } from '$env/static/private';
import { m } from '$lib/paraglide/messages';
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, params, depends, cookies }) {
	depends('app:conduits');
	const { projectId, flagId } = params;

	if (!projectId || !flagId) {
		return { conduits: [], conduitsError: null };
	}

	try {
		let url = `${API_URL}conduit/all/?project=${params.projectId}&flag=${params.flagId}`;
		const response = await fetch(url, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch conduits: ${response.status}`);
			return { conduits: [], conduitsError: m.error_fetching_conduits() };
		}

		const data = await response.json();
		const conduits = data.map((item) => ({
			value: item.uuid,
			label: item.name
		}));
		return { conduits, conduitsError: null };
	} catch (error) {
		console.error('Error fetching conduits:', error);
		return { conduits: [], conduitsError: m.error_fetching_conduits() };
	}
}

function getAuthHeaders(cookies) {
	const accessToken = cookies.get('api-access-token');
	const headers = new Headers();
	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}
	return headers;
}

/** @type {import('./$types').Actions} */
export const actions = {
	getTrenchData: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const trenchLabel = data.get('trenchLabel');

		if (!trenchLabel) {
			throw error(400, 'Trench label is required');
		}

		try {
			const response = await fetch(`${API_URL}ol_trench/?id_trench=${trenchLabel}`, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			});

			if (!response.ok) {
				throw error(response.status, 'Failed to fetch trench data');
			}

			const trenchData = await response.json();
			return { success: true, trenchData };
		} catch (err) {
			console.error('Error fetching trench data:', err);
			throw error(500, 'Failed to fetch trench data');
		}
	}
};
