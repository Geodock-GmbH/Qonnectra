import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, url, depends, cookies, params }) {
	depends('app:conduits');
	const headers = getAuthHeaders(cookies);
	const searchParams = url.searchParams;
	const projectId = params.projectId;
	const searchTerm = searchParams.get('search') || '';

	if (!projectId) {
		return {
			pipes: [],
			pipesError: null,
			searchTerm,
			projectId,
			// Add select options here
			conduitTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: []
		};
	}

	try {
		// Fetch pipes and select options in parallel
		const [pipesResponse, ...selectResponses] = await Promise.all([
			// Pipes data
			fetch(
				`${API_URL}conduit/all/?project=${projectId}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`,
				{
					credentials: 'include',
					headers: headers
				}
			),
			// Select options
			fetch(`${API_URL}attributes_conduit_type/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_status/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_network_level/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_company/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}flags/`, { credentials: 'include', headers: headers })
		]);

		// Process pipes data
		if (!pipesResponse.ok) {
			console.error(`Failed to fetch conduits: ${pipesResponse.status}`);
			return {
				pipes: [],
				pipesError: 'Failed to fetch conduits',
				searchTerm,
				projectId,
				conduitTypes: [],
				statuses: [],
				networkLevels: [],
				companies: [],
				flags: []
			};
		}

		const pipesData = await pipesResponse.json();
		const pipes = pipesData.map((item) => ({
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

		// Process select options
		const [conduitTypesData, statusesData, networkLevelsData, companiesData, flagsData] =
			await Promise.all(selectResponses.map((res) => (res.ok ? res.json() : [])));

		const conduitTypes = conduitTypesData.map((item) => ({
			value: item.id,
			label: item.conduit_type
		}));

		const statuses = statusesData.map((item) => ({
			value: item.id,
			label: item.status
		}));

		const networkLevels = networkLevelsData.map((item) => ({
			value: item.id,
			label: item.network_level
		}));

		const companies = companiesData.map((item) => ({
			value: item.id,
			label: item.company
		}));

		const flags = flagsData.map((item) => ({
			value: item.id,
			label: item.flag
		}));

		return {
			pipes,
			pipesError: null,
			searchTerm,
			projectId,
			conduitTypes,
			statuses,
			networkLevels,
			companies,
			flags
		};
	} catch (err) {
		console.error('Error fetching data:', err);
		return {
			pipes: [],
			pipesError: 'Error occurred while fetching data',
			searchTerm,
			projectId,
			conduitTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: []
		};
	}
}
