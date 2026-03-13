import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';
import { getMicroducts, getPipesInTrench } from '$lib/server/conduitData';
import {
	getFeatureDetailsByType,
	getLayerExtent,
	getTrenchUuidsForConduit,
	searchFeaturesInProject
} from '$lib/server/featureSearch';

/**
 * Loads attribute data (node types, surfaces, construction types, area types) for the house connections page.
 * @param {import('./$types').PageServerLoadEvent} event
 */
export async function load({ fetch, cookies }) {
	const [nodeTypesData, surfacesData, constructionTypesData, areaTypesData] = await Promise.all([
		getNodeTypes(fetch, cookies),
		getSurfaces(fetch, cookies),
		getConstructionTypes(fetch, cookies),
		getAreaTypes(fetch, cookies)
	]);

	return {
		...nodeTypesData,
		...surfacesData,
		...constructionTypesData,
		...areaTypesData
	};
}

/** @satisfies {import('./$types').Actions} */
export const actions = {
	/**
	 * Retrieves conduit pipes for a given trench.
	 * @param {import('./$types').RequestEvent} event
	 */
	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = /** @type {string} */ (formData.get('uuid'));

		return getPipesInTrench(fetch, cookies, trenchId);
	},

	/**
	 * Retrieves microducts for a given conduit pipe.
	 * @param {import('./$types').RequestEvent} event
	 */
	getMicroducts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const pipeId = /** @type {string} */ (formData.get('uuid'));

		return getMicroducts(fetch, cookies, pipeId);
	},
	/**
	 * Assigns a node to a microduct via PATCH request.
	 * @param {import('./$types').RequestEvent} event
	 */
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
	/**
	 * Removes the node assignment from a microduct via PATCH request.
	 * @param {import('./$types').RequestEvent} event
	 */
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
	/**
	 * Searches for features within the current project.
	 * @param {import('./$types').RequestEvent} event
	 */
	searchFeatures: async ({ request, fetch, cookies, params }) => {
		const data = await request.formData();
		const searchQuery = /** @type {string} */ (data.get('searchQuery'));
		const projectId = params.projectId;

		return searchFeaturesInProject(fetch, cookies, searchQuery, projectId ?? '');
	},
	/**
	 * Retrieves detailed properties for a specific feature by type and UUID.
	 * @param {import('./$types').RequestEvent} event
	 */
	getFeatureDetails: async ({ request, fetch, cookies, params }) => {
		const data = await request.formData();
		const featureType = /** @type {'trench' | 'node' | 'address'} */ (data.get('featureType'));
		const featureUuid = /** @type {string} */ (data.get('featureUuid'));

		return getFeatureDetailsByType(
			fetch,
			cookies,
			featureType,
			featureUuid,
			params.projectId ?? ''
		);
	},

	/**
	 * Retrieves trench UUIDs associated with a conduit.
	 * @param {import('./$types').RequestEvent} event
	 */
	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = /** @type {string} */ (formData.get('conduitUuid'));

		return getTrenchUuidsForConduit(fetch, cookies, conduitUuid);
	},
	/**
	 * Retrieves the spatial extent for a layer type within a project.
	 * @param {import('./$types').RequestEvent} event
	 */
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = /** @type {'trench' | 'address' | 'node'} */ (formData.get('layerType'));
		const projectId = /** @type {string} */ (formData.get('projectId'));

		return getLayerExtent(fetch, cookies, layerType, projectId);
	}
};
