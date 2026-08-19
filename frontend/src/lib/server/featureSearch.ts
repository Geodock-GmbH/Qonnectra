import type { Cookies } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { m } from '$lib/paraglide/messages';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

export interface SearchResult {
	/** The feature UUID as a string */
	value: string;
	/** Display label for the search result */
	label: string;
	/** Type of the feature */
	type: 'address' | 'node' | 'trench' | 'conduit' | 'area';
	/** The feature UUID */
	uuid: string;
	/** Optional name (for nodes, conduits, areas) */
	name?: string;
	/** Optional trench ID number (for trenches) */
	id_trench?: string;
}

export interface GeoJSONProperties {
	/** Feature name */
	name?: string;
	/** Trench ID number */
	id_trench?: string;
}

export interface GeoJSONFeature {
	/** Feature ID */
	id: string;
	/** Feature properties */
	properties: GeoJSONProperties;
	/** Feature geometry */
	geometry?: unknown;
}

export interface AddressProperties {
	/** Street name */
	street?: string;
	/** House number */
	housenumber?: string;
	/** House number suffix */
	house_number_suffix?: string;
}

export interface AddressFeature {
	/** Address UUID (non-GeoJSON format) */
	uuid?: string;
	/** Address ID (GeoJSON format) */
	id?: string;
	/** GeoJSON properties */
	properties?: AddressProperties;
	/** Street name (non-GeoJSON format) */
	street?: string;
	/** House number (non-GeoJSON format) */
	housenumber?: string;
	/** House number suffix (non-GeoJSON format) */
	house_number_suffix?: string;
}

export interface ConduitFeature {
	/** Conduit UUID */
	uuid: string;
	/** Conduit name */
	name: string;
	/** Conduit type name */
	conduit_type?: string;
}

/**
 * Searches for features (addresses, nodes, trenches, conduits, areas) within a project.
 */
export async function searchFeaturesInProject(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	searchQuery: string,
	projectId: string
): Promise<SearchResult[]> {
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

		const results: SearchResult[] = [];

		const addressFeatures: AddressFeature[] =
			addAddressData.results || addAddressData.features || addAddressData || [];
		const nodeFeatures: GeoJSONFeature[] = nodeData.features || nodeData || [];
		const trenchFeatures: GeoJSONFeature[] = trenchData.features || trenchData || [];
		const areaFeatures: GeoJSONFeature[] = areaData.features || areaData || [];

		addressFeatures.forEach((address) => {
			const isGeoJSON = !!address.properties;
			const props: AddressProperties = isGeoJSON ? address.properties || {} : address;
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

		const conduitFeatures: ConduitFeature[] = conduitData.results || conduitData || [];
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
 */
export async function getFeatureDetailsByType(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	featureType: 'node' | 'trench' | 'address' | 'area',
	featureUuid: string,
	projectId: string
): Promise<{ success: boolean; feature: GeoJSONFeature }> {
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
 */
export async function getTrenchUuidsForConduit(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	conduitUuid: string
): Promise<{ success: boolean; trenches: GeoJSONFeature[]; trenchUuids: string[] }> {
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
		const trenchUuids: string[] = trench_uuids || [];

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
			}).then((res) => res.json())
		);

		const trenchResponses = await Promise.all(trenchPromises);
		const trenches: GeoJSONFeature[] = trenchResponses
			.map((r) => r.results?.features?.[0] || r[0])
			.filter(Boolean);

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
 */
export async function getLayerExtent(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	layerType: 'trench' | 'address' | 'node',
	projectId: string
): Promise<{ extent: [number, number, number, number] | null; layer: string }> {
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
