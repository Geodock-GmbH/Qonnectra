import { API_URL } from '$env/static/private';
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, url, depends, cookies, params }) {
	depends('app:conduits');

	const searchParams = url.searchParams;
	const projectId = params.projectId;
	const searchTerm = searchParams.get('search') || '';

	if (!projectId) {
		return {
			pipes: [],
			pipesError: null,
			searchTerm,
			projectId
		};
	}

	try {
		let apiUrl = `${API_URL}conduit/all/?project=${projectId}`;
		if (searchTerm) {
			apiUrl += `&search=${encodeURIComponent(searchTerm)}`;
		}

		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();
		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

		const response = await fetch(apiUrl, {
			credentials: 'include',
			headers
		});

		if (!response.ok) {
			console.error(`Failed to fetch conduits: ${response.status}`);
			return {
				pipes: [],
				pipesError: 'Failed to fetch conduits',
				searchTerm,
				projectId
			};
		}

		const data = await response.json();
		const pipes = data.map((item) => ({
			value: item.uuid,
			name: item.name,
			conduit_type: item.conduit_type.conduit_type,
			outer_conduit: item.outer_conduit,
			status: item.status ? item.status.status : '',
			network_level: item.network_level ? item.network_level.network_level : '',
			owner: item.owner ? item.owner.company : '',
			constructor: item.constructor ? item.constructor.company : '',
			manufacturer: item.manufacturer ? item.manufacturer.company : '',
			date: item.date,
			flag: item.flag.flag
		}));

		return {
			pipes,
			pipesError: null,
			searchTerm,
			projectId
		};
	} catch (err) {
		console.error('Error fetching conduits:', err);
		return {
			pipes: [],
			pipesError: 'Error occurred while fetching conduits',
			searchTerm,
			projectId
		};
	}
}
