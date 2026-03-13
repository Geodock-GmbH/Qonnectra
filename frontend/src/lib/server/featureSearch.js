import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { m } from '$lib/paraglide/messages';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * @typedef {Object} SearchResult
 * @property {string} value - The feature UUID as a string
 * @property {string} label - Display label for the search result
 * @property {'address' | 'node' | 'trench' | 'conduit' | 'area'} type - Type of the feature
 * @property {string} uuid - The feature UUID
 * @property {string} [name] - Optional name (for nodes, conduits, areas)
 * @property {string} [id_trench] - Optional trench ID number (for trenches)
 */

/**
 * @typedef {Object} GeoJSONProperties
 * @property {string} [name] - Feature name
 * @property {string} [id_trench] - Trench ID number
 */

/**
 * @typedef {Object} GeoJSONFeature
 * @property {string} id - Feature ID
 * @property {GeoJSONProperties} properties - Feature properties
 * @property {Object} [geometry] - Feature geometry
 */

/**
 * @typedef {Object} AddressProperties
 * @property {string} [street] - Street name
 * @property {string} [housenumber] - House number
 * @property {string} [house_number_suffix] - House number suffix
 */

/**
 * @typedef {Object} AddressFeature
 * @property {string} [uuid] - Address UUID (non-GeoJSON format)
 * @property {string} [id] - Address ID (GeoJSON format)
 * @property {AddressProperties} [properties] - GeoJSON properties
 * @property {string} [street] - Street name (non-GeoJSON format)
 * @property {string} [housenumber] - House number (non-GeoJSON format)
 * @property {string} [house_number_suffix] - House number suffix (non-GeoJSON format)
 */

/**
 * @typedef {Object} ConduitFeature
 * @property {string} uuid - Conduit UUID
 * @property {string} name - Conduit name
 * @property {string} [conduit_type] - Conduit type name
 */

/**
 * Searches for features (addresses, nodes, trenches, conduits, areas) within a project.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} searchQuery - The search query string
 * @param {string} projectId - The project ID to search within
 * @returns {Promise<SearchResult[]>} Array of matching search results
 */
export async function searchFeaturesInProject(fetch, cookies, searchQuery, projectId) {
	if (!searchQuery) {
		throw error(400, 'Search query is required');
	}

	const projectParam = projectId ? `&project=${projectId}` : '';

	try {
		const [addAddressResponse, nodeResponse, trenchResponse, conduitResponse, areaResponse] =
			await Promise.all([
				fetch(`${API_URL}address/all/?search=${encodeURIComponent(searchQuery)}${projectParam}`, {
					credentials: 'include',
					headers: getAuthHeaders(cookies)
				}),
				fetch(
					`${API_URL}node/all/?search=${encodeURIComponent(searchQuery)}${projectParam}&include_excluded=true`,
					{
						credentials: 'include',
						headers: getAuthHeaders(cookies)
					}
				),
				fetch(`${API_URL}trench/all/?search=${encodeURIComponent(searchQuery)}${projectParam}`, {
					credentials: 'include',
					headers: getAuthHeaders(cookies)
				}),
				fetch(`${API_URL}conduit/all/?search=${encodeURIComponent(searchQuery)}${projectParam}`, {
					credentials: 'include',
					headers: getAuthHeaders(cookies)
				}),
				fetch(`${API_URL}area/all/?search=${encodeURIComponent(searchQuery)}${projectParam}`, {
					credentials: 'include',
					headers: getAuthHeaders(cookies)
				})
			]);

		if (
			!addAddressResponse.ok ||
			!nodeResponse.ok ||
			!trenchResponse.ok ||
			!conduitResponse.ok ||
			!areaResponse.ok
		) {
			throw error(500, 'Failed to fetch search results');
		}

		const [addAddressData, nodeData, trenchData, conduitData, areaData] = await Promise.all([
			addAddressResponse.json(),
			nodeResponse.json(),
			trenchResponse.json(),
			conduitResponse.json(),
			areaResponse.json()
		]);

		/** @type {Array<SearchResult>} */
		const results = [];

		/** @type {Array<AddressFeature>} */
		const addressFeatures =
			addAddressData.results || addAddressData.features || addAddressData || [];
		/** @type {Array<GeoJSONFeature>} */
		const nodeFeatures = nodeData.features || nodeData || [];
		/** @type {Array<GeoJSONFeature>} */
		const trenchFeatures = trenchData.features || trenchData || [];
		/** @type {Array<GeoJSONFeature>} */
		const areaFeatures = areaData.features || areaData || [];

		addressFeatures.forEach((address) => {
			const isGeoJSON = !!address.properties;
			/** @type {AddressProperties} */
			const props = isGeoJSON ? address.properties || {} : address;
			const addressId = isGeoJSON ? address.id : address.uuid;
			if (!addressId) return;
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
			const nodeName = props?.name;

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
			const trenchIdNumber = props?.id_trench;

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

		/** @type {Array<ConduitFeature>} */
		const conduitFeatures = conduitData.results || conduitData || [];
		conduitFeatures.forEach((conduit) => {
			const conduitUuid = conduit.uuid;
			const conduitName = conduit.name;
			const conduitTypeName = conduit.conduit_type || '';

			if (conduitUuid && conduitName) {
				const labelParts = [conduitName];
				if (conduitTypeName) {
					labelParts.push(`- ${conduitTypeName}`);
				}
				labelParts.push(`(${m.form_conduit({ count: 1 })})`);

				results.push({
					value: `${conduitUuid}`,
					label: labelParts.join(' '),
					type: 'conduit',
					uuid: conduitUuid,
					name: conduitName
				});
			}
		});

		areaFeatures.forEach((area) => {
			const props = area.properties;
			const areaId = area.id;
			const areaName = props?.name;

			if (areaId && areaName) {
				results.push({
					value: `${areaId}`,
					label: `${areaName}` + ' ' + '(' + m.form_area() + ')',
					type: 'area',
					uuid: areaId,
					name: areaName
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
 * Gets detailed information about a specific feature.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {'node' | 'trench' | 'address' | 'area'} featureType - Type of feature
 * @param {string} featureUuid - UUID of the feature
 * @param {string} projectId - The project ID to filter by
 * @returns {Promise<{success: boolean, feature: GeoJSONFeature}>} Feature details with geometry
 */
export async function getFeatureDetailsByType(fetch, cookies, featureType, featureUuid, projectId) {
	if (!featureType || !featureUuid) {
		throw error(400, 'Feature type and UUID are required');
	}

	try {
		let apiEndpoint;
		const projectParam = projectId ? `&project=${projectId}` : '';
		if (featureType === 'node') {
			apiEndpoint = `${API_URL}node/?uuid=${featureUuid}${projectParam}`;
		} else if (featureType === 'trench') {
			apiEndpoint = `${API_URL}trench/?uuid=${featureUuid}${projectParam}`;
		} else if (featureType === 'address') {
			apiEndpoint = `${API_URL}address/?uuid=${featureUuid}${projectParam}`;
		} else if (featureType === 'area') {
			apiEndpoint = `${API_URL}area/?uuid=${featureUuid}${projectParam}`;
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

/**
 * Gets all trench UUIDs and geometries for a conduit (conduits span multiple trenches).
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {string} conduitUuid - UUID of the conduit
 * @returns {Promise<{success: boolean, trenches: GeoJSONFeature[], trenchUuids: string[]}>} Trench features and UUIDs
 */
export async function getTrenchUuidsForConduit(fetch, cookies, conduitUuid) {
	if (!conduitUuid) {
		throw error(400, 'Conduit UUID is required');
	}

	try {
		const trenchesResponse = await fetch(`${API_URL}conduit/${conduitUuid}/trenches/`, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!trenchesResponse.ok) {
			throw error(trenchesResponse.status, 'Failed to fetch trenches for conduit');
		}

		const { trench_uuids } = await trenchesResponse.json();
		/** @type {Array<string>} */
		const trenchUuids = trench_uuids || [];

		if (trenchUuids.length === 0) {
			return {
				success: true,
				trenches: [],
				trenchUuids: []
			};
		}

		const trenchPromises = trenchUuids.map((uuid) =>
			fetch(`${API_URL}trench/?uuid=${uuid}`, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			}).then((/** @type {Response} */ res) => res.json())
		);

		const trenchResponses = await Promise.all(trenchPromises);
		/** @type {Array<GeoJSONFeature>} */
		const trenches = trenchResponses.map((r) => r.results?.features?.[0] || r[0]).filter(Boolean);

		return {
			success: true,
			trenches,
			trenchUuids
		};
	} catch (err) {
		console.error('Error fetching trenches for conduit:', err);
		throw error(500, 'Failed to fetch trenches for conduit');
	}
}

/**
 * Gets the bounding box extent for a layer type.
 * @param {typeof fetch} fetch - SvelteKit fetch function
 * @param {import('@sveltejs/kit').Cookies} cookies - Request cookies
 * @param {'trench' | 'address' | 'node'} layerType - Type of layer
 * @param {string} projectId - The project ID
 * @returns {Promise<{extent: [number, number, number, number] | null, layer: string}>} Layer extent in EPSG:3857
 */
export async function getLayerExtent(fetch, cookies, layerType, projectId) {
	if (!layerType || !projectId) {
		throw error(400, 'Layer type and project ID are required');
	}

	try {
		const response = await fetch(
			`${API_URL}layer-extent/?layer=${encodeURIComponent(layerType)}&project=${projectId}`,
			{
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			}
		);

		if (!response.ok) {
			throw error(response.status, 'Failed to fetch layer extent');
		}

		return response.json();
	} catch (err) {
		console.error('Error fetching layer extent:', err);
		throw error(500, 'Failed to fetch layer extent');
	}
}
