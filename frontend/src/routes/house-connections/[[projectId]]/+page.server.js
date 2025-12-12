import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { getConstructionTypes, getNodeTypes, getSurfaces } from '$lib/server/attributes';
import { getMicroducts, getPipesInTrench } from '$lib/server/conduitData';
import {
	getFeatureDetailsByType,
	getTrenchGeometriesForConduit,
	searchFeaturesInProject
} from '$lib/server/featureSearch';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies }) {
	const [nodeTypesData, surfacesData, constructionTypesData] = await Promise.all([
		getNodeTypes(fetch, cookies),
		getSurfaces(fetch, cookies),
		getConstructionTypes(fetch, cookies)
	]);

	return {
		...nodeTypesData,
		...surfacesData,
		...constructionTypesData
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = formData.get('uuid');

		return getPipesInTrench(fetch, cookies, trenchId);
	},

	getMicroducts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const pipeId = formData.get('uuid');

		return getMicroducts(fetch, cookies, pipeId);
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

		return searchFeaturesInProject(fetch, cookies, searchQuery, projectId);
	},
	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = data.get('featureType');
		const featureUuid = data.get('featureUuid');

		return getFeatureDetailsByType(fetch, cookies, featureType, featureUuid);
	},

	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid');

		return getTrenchGeometriesForConduit(fetch, cookies, conduitUuid);
	}
};
