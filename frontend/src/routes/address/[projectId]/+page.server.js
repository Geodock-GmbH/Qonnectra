import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, url, depends, cookies, params }) {
	depends('app:addresses');
	const headers = getAuthHeaders(cookies);
	const searchParams = url.searchParams;
	const projectId = params.projectId;
	const searchTerm = searchParams.get('search') || '';

	if (!projectId) {
		return {
			addresses: [],
			addressesError: null,
			searchTerm,
			projectId,
			statusDevelopments: [],
			flags: []
		};
	}

	try {
		// Fetch addresses and select options in parallel
		const [addressesResponse, ...selectResponses] = await Promise.all([
			// Addresses data
			fetch(
				`${API_URL}address/all/?project=${projectId}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`,
				{
					credentials: 'include',
					headers: headers
				}
			),
			// Select options
			fetch(`${API_URL}attributes_status_development/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}flags/`, { credentials: 'include', headers: headers })
		]);

		// Process addresses data
		if (!addressesResponse.ok) {
			console.error(`Failed to fetch addresses: ${addressesResponse.status}`);
			return {
				addresses: [],
				addressesError: 'Failed to fetch addresses',
				searchTerm,
				projectId,
				statusDevelopments: [],
				flags: []
			};
		}

		const addressesData = await addressesResponse.json();
		// GeoFeatureModelSerializer returns GeoJSON format with features array
		// The id (uuid) is at feature.id level, other fields in feature.properties
		const features = addressesData.features || [];
		const addresses = features.map((feature) => {
			const item = feature.properties;
			return {
				value: feature.id,
				street: item.street || '',
				housenumber: item.housenumber ?? '',
				house_number_suffix: item.house_number_suffix || '',
				zip_code: item.zip_code || '',
				city: item.city || '',
				district: item.district || '',
				status_development: item.status_development?.status_development || '',
				flag: item.flag?.flag || ''
			};
		});

		// Process select options
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
			addressesError: 'Error occurred while fetching data',
			searchTerm,
			projectId,
			statusDevelopments: [],
			flags: []
		};
	}
}
