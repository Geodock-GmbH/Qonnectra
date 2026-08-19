import type { Actions, PageServerLoad } from './$types';
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
 */
export const load: PageServerLoad = async ({ fetch, cookies }) => {
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
};

export const actions = {
	/**
	 * Retrieves conduit pipes for a given trench.
	 */
	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = formData.get('uuid') as string;

		return getPipesInTrench(fetch, cookies, trenchId);
	},

	/**
	 * Retrieves microducts for a given conduit pipe.
	 */
	getMicroducts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const pipeId = formData.get('uuid') as string;

		return getMicroducts(fetch, cookies, pipeId);
	},
	/**
	 * Assigns a node to a microduct via PATCH request.
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
	 */
	searchFeatures: async ({ request, fetch, cookies, params }) => {
		const data = await request.formData();
		const searchQuery = data.get('searchQuery') as string;
		const projectId = params.projectId;

		return searchFeaturesInProject(fetch, cookies, searchQuery, projectId ?? '');
	},
	/**
	 * Retrieves detailed properties for a specific feature by type and UUID.
	 */
	getFeatureDetails: async ({ request, fetch, cookies, params }) => {
		const data = await request.formData();
		const featureType = data.get('featureType') as 'trench' | 'node' | 'address';
		const featureUuid = data.get('featureUuid') as string;

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
	 */
	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid') as string;

		return getTrenchUuidsForConduit(fetch, cookies, conduitUuid);
	},
	/**
	 * Retrieves the spatial extent for a layer type within a project.
	 */
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = formData.get('layerType') as 'trench' | 'address' | 'node';
		const projectId = formData.get('projectId') as string;

		return getLayerExtent(fetch, cookies, layerType, projectId);
	}
} satisfies Actions;
