import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { m } from '$lib/paraglide/messages';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

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
			return { conduits: [], conduitsError: m.title_error_fetching_conduits() };
		}

		const data = await response.json();
		const conduits = data.map((item) => ({
			value: item.uuid,
			label: item.name
		}));
		return { conduits, conduitsError: null };
	} catch (error) {
		console.error('Error fetching conduits:', error);
		return { conduits: [], conduitsError: m.title_error_fetching_conduits() };
	}
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
