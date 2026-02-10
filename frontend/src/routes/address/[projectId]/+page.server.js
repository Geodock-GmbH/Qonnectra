import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, url, depends, cookies, params }) {
	depends('app:addresses');
	const headers = getAuthHeaders(cookies);
	const projectId = params.projectId;
	const searchTerm = url.searchParams.get('search') || '';
	const page = url.searchParams.get('page') || '1';
	const pageSize = url.searchParams.get('page_size') || '50';

	if (!projectId) {
		return {
			addresses: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
			addressesError: null,
			searchTerm,
			projectId,
			statusDevelopments: [],
			flags: []
		};
	}

	try {
		const apiUrl = new URL(`${API_URL}address/all/`);
		apiUrl.searchParams.set('project', projectId);
		if (searchTerm) apiUrl.searchParams.set('search', searchTerm);
		apiUrl.searchParams.set('page', page);
		apiUrl.searchParams.set('page_size', pageSize);

		const [addressesResponse, ...selectResponses] = await Promise.all([
			fetch(apiUrl.toString(), { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_status_development/`, {
				credentials: 'include',
				headers
			}),
			fetch(`${API_URL}flags/`, { credentials: 'include', headers })
		]);

		if (!addressesResponse.ok) {
			console.error(`Failed to fetch addresses: ${addressesResponse.status}`);
			return {
				addresses: [],
				pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
				addressesError: 'Failed to fetch addresses',
				searchTerm,
				projectId,
				statusDevelopments: [],
				flags: []
			};
		}

		const addressesData = await addressesResponse.json();

		const addresses = (addressesData.results || []).map((item) => ({
			value: item.uuid,
			id_address: item.id_address || '',
			street: item.street || '',
			housenumber: item.housenumber ?? '',
			house_number_suffix: item.house_number_suffix || '',
			zip_code: item.zip_code || '',
			city: item.city || '',
			district: item.district || '',
			status_development: item.status_development || '',
			flag: item.flag || ''
		}));

		const [statusDevelopmentsData, flagsData] = await Promise.all(
			selectResponses.map((res) => (res.ok ? res.json() : []))
		);

		const statusDevelopments = statusDevelopmentsData.map((item) => ({
			value: item.id,
			label: item.status_development
		}));

		const flags = flagsData.map((item) => ({
			value: item.id,
			label: item.flag
		}));

		return {
			addresses,
			pagination: {
				page: addressesData.page || 1,
				pageSize: addressesData.page_size || 50,
				totalCount: addressesData.count || 0,
				totalPages: addressesData.total_pages || 0
			},
			addressesError: null,
			searchTerm,
			projectId,
			statusDevelopments,
			flags
		};
	} catch (err) {
		console.error('Error fetching data:', err);
		return {
			addresses: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 },
			addressesError: 'Error occurred while fetching data',
			searchTerm,
			projectId,
			statusDevelopments: [],
			flags: []
		};
	}
}
