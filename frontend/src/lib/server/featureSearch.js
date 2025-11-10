import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';
import { m } from '$lib/paraglide/messages';
import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Search for features (addresses, nodes, trenches) within a project
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} searchQuery - The search query string
 * @param {string} projectId - The project ID to search within
 * @returns {Promise<Array>} Array of search results
 */
export async function searchFeaturesInProject(fetch, cookies, searchQuery, projectId) {
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
}

/**
 * Get detailed information about a specific feature
 * @param {Function} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} featureType - Type of feature ('node', 'trench', or 'address')
 * @param {string} featureUuid - UUID of the feature
 * @returns {Promise<{success: boolean, feature: any}>} Feature details
 */
export async function getFeatureDetailsByType(fetch, cookies, featureType, featureUuid) {
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
