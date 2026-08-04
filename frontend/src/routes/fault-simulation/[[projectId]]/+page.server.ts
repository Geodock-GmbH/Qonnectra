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
import {
	getFeatureDetailsByType,
	getLayerExtent,
	getTrenchUuidsForConduit,
	searchFeaturesInProject
} from '$lib/server/featureSearch';

/**
 * Loads attribute data (node types, surfaces, construction types, area types) for the fault simulation page.
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

type FeatureType = 'trench' | 'node' | 'address';
type LayerType = 'trench' | 'address' | 'node';

export const actions = {
	/**
	 * Runs a fault simulation at the given coordinates within a project.
	 */
	simulate: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const pointX = parseFloat(String(formData.get('pointX')));
		const pointY = parseFloat(String(formData.get('pointY')));
		const projectId = String(formData.get('projectId'));

		if (isNaN(pointX) || isNaN(pointY)) {
			return fail(400, { error: 'Valid coordinates are required' });
		}

		if (!projectId) {
			return fail(400, { error: 'Project ID is required' });
		}

		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fault-simulation/`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					point: [pointX, pointY],
					project_id: projectId
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.error || 'Simulation failed'
				});
			}

			const result = await response.json();
			return { success: true, result };
		} catch (err) {
			console.error('Fault simulation error:', err);
			return fail(500, { error: 'Internal server error during simulation' });
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
		const featureType = data.get('featureType') as FeatureType;
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
		const layerType = formData.get('layerType') as LayerType;
		const projectId = formData.get('projectId') as string;

		return getLayerExtent(fetch, cookies, layerType, projectId);
	}
} satisfies Actions;
