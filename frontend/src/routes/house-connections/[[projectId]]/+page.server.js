import { error, fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { m } from '$lib/paraglide/messages';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

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
	},
	getMicroducts: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const pipeId = formData.get('uuid');

			if (!pipeId) {
				return fail(400, { error: 'Pipe ID is required' });
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}microduct/all/?uuid_conduit=${pipeId}`;

			const response = await fetch(backendUrl, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to get microducts' });
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error getting microducts:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},
	assignNodeToMicroduct: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const microductUuid = formData.get('microductUuid');
			const nodeUuid = formData.get('nodeUuid');

			if (!microductUuid) {
				return fail(400, { error: 'Microduct UUID is required' });
			}

			if (!nodeUuid) {
				return fail(400, { error: 'Node UUID is required' });
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}microduct/${microductUuid}/`;

			const response = await fetch(backendUrl, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					uuid_node_id: nodeUuid
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				return fail(response.status, { error: errorData.error || 'Failed to assign node' });
			}

			const data = await response.json();
			return { microduct: data };
		} catch (error) {
			console.error('Error assigning node to microduct:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},
	removeNodeFromMicroduct: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const microductUuid = formData.get('microductUuid');

			if (!microductUuid) {
				return fail(400, { error: 'Microduct UUID is required' });
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}microduct/${microductUuid}/`;

			const response = await fetch(backendUrl, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					uuid_node_id: null
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error('Error removing node from microduct:', errorData);
				return fail(response.status, { error: errorData.error || 'Failed to remove node' });
			}

			const data = await response.json();
			return { microduct: data };
		} catch (error) {
			console.error('Error removing node from microduct:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},
	searchFeatures: async ({ request, fetch, cookies, params }) => {
		const data = await request.formData();
		const searchQuery = data.get('searchQuery');
		const projectId = params.projectId;

		if (!searchQuery || !projectId) {
			throw error(400, 'Search query and project ID are required');
		}

		try {
			const [addAddressResponse, nodeResponse, trenchResponse] = await Promise.all([
				fetch(
					`${API_URL}address/all/?search=${encodeURIComponent(searchQuery)}&project=${projectId}`,
					{
						credentials: 'include',
						headers: getAuthHeaders(cookies)
					}
				),
				fetch(
					`${API_URL}node/all/?search=${encodeURIComponent(searchQuery)}&project=${projectId}`,
					{
						credentials: 'include',
						headers: getAuthHeaders(cookies)
					}
				),
				fetch(
					`${API_URL}trench/all/?search=${encodeURIComponent(searchQuery)}&project=${projectId}`,
					{
						credentials: 'include',
						headers: getAuthHeaders(cookies)
					}
				)
			]);

			if (!addAddressResponse.ok || !nodeResponse.ok || !trenchResponse.ok) {
				throw error(500, 'Failed to fetch search results');
			}

			const [addAddressData, nodeData, trenchData] = await Promise.all([
				addAddressResponse.json(),
				nodeResponse.json(),
				trenchResponse.json()
			]);

			const results = [];

			const addressFeatures = addAddressData.features || addAddressData || [];
			const nodeFeatures = nodeData.features || nodeData || [];
			const trenchFeatures = trenchData.features || trenchData || [];

			addressFeatures.forEach((address) => {
				const props = address.properties;
				const addressId = address.id;
				const addressName = [props.street, props.housenumber, props.house_number_suffix]
					.filter(Boolean)
					.join(' ');
				results.push({
					value: `${addressId}`,
					label: `${addressName}` + ' ' + '(' + m.form_address({ count: 1 }) + ')',
					type: 'address',
					uuid: addressId
				});
			});

			nodeFeatures.forEach((node) => {
				const props = node.properties;
				const nodeId = node.id;
				const nodeName = props.name;

				if (nodeId && nodeName) {
					results.push({
						value: `${nodeId}`,
						label: `${nodeName}` + ' ' + '(' + m.form_node() + ')',
						type: 'node',
						uuid: nodeId,
						name: nodeName
					});
				}
			});

			trenchFeatures.forEach((trench) => {
				const props = trench.properties;
				const trenchId = trench.id;
				const trenchIdNumber = props.id_trench;

				if (trenchId && trenchIdNumber) {
					results.push({
						value: `${trenchId}`,
						label: `${trenchIdNumber}` + ' ' + '(' + m.nav_trench() + ')',
						type: 'trench',
						uuid: trenchId,
						id_trench: trenchIdNumber
					});
				}
			});
			return results;
		} catch (err) {
			console.error('Error searching features:', err);
			throw error(500, 'Failed to search features');
		}
	},
	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = data.get('featureType');
		const featureUuid = data.get('featureUuid');

		if (!featureType || !featureUuid) {
			throw error(400, 'Feature type and UUID are required');
		}

		try {
			let apiEndpoint;
			if (featureType === 'node') {
				apiEndpoint = `${API_URL}ol_node/?uuid=${featureUuid}`;
			} else if (featureType === 'trench') {
				apiEndpoint = `${API_URL}ol_trench/?uuid=${featureUuid}`;
			} else if (featureType === 'address') {
				apiEndpoint = `${API_URL}ol_address/?uuid=${featureUuid}`;
			} else {
				throw error(400, 'Invalid feature type');
			}

			const response = await fetch(apiEndpoint, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			});

			if (!response.ok) {
				throw error(response.status, 'Failed to fetch feature details');
			}

			const featureData = await response.json();

			const feature = featureData.results?.features || featureData[0];

			if (!feature) {
				throw error(404, 'Feature not found');
			}

			return { success: true, feature };
		} catch (err) {
			console.error('Error fetching feature details:', err);
			throw error(500, 'Failed to fetch feature details');
		}
	}
};
