import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, url, cookies }) {
	const headers = getAuthHeaders(cookies);
	const searchTerm = url.searchParams.get('search') || '';
	const page = url.searchParams.get('page') || '1';
	const pageSize = url.searchParams.get('page_size') || '50';

	try {
		const apiUrl = new URL(`${API_URL}pipeline-records/`);
		if (searchTerm) apiUrl.searchParams.set('search', searchTerm);
		apiUrl.searchParams.set('page', page);
		apiUrl.searchParams.set('page_size', pageSize);

		const response = await fetch(apiUrl.toString(), {
			credentials: 'include',
			headers
		});

		if (!response.ok) {
			console.error(`Failed to fetch pipeline records: ${response.status}`);
			return {
				records: [],
				pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
				recordsError: 'Failed to fetch pipeline records',
				searchTerm
			};
		}

		const data = await response.json();

		const records = (data.results || []).map((/** @type {any} */ item) => ({
			value: item.uuid,
			project_name: item.project_name || '',
			building_measure: item.building_measure || '',
			type_of_work: item.type_of_work || '',
			created_at: item.created_at || '',
			modified_at: item.modified_at || ''
		}));

		return {
			records,
			pagination: {
				page: data.page || 1,
				pageSize: data.page_size || 50,
				totalCount: data.count || 0,
				totalPages: data.total_pages || 0
			},
			recordsError: null,
			searchTerm
		};
	} catch (err) {
		console.error('Error fetching pipeline records:', err);
		return {
			records: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
			recordsError: 'Error occurred while fetching data',
			searchTerm
		};
	}
}
