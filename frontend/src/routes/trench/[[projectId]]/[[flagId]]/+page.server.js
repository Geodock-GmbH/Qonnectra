import { API_URL } from '$env/static/private';
import { m } from '$lib/paraglide/messages';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, params, depends }) {
	depends('app:conduits');
	const { projectId, flagId } = params;

	if (!projectId || !flagId) {
		return { conduits: [], conduitsError: null };
	}

	try {
		let url = `${API_URL}conduit/all/?project=${params.projectId}&flag=${params.flagId}`;
		const response = await fetch(url, { credentials: 'include' });

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
