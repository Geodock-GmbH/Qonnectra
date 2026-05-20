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
 * @param {import('./$types').PageServerLoadEvent} event
 * @returns {Promise<Record<string, any>>}
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
	 * Runs a fault simulation at the given coordinates within a project.
	 * @type {import('./$types').Action}
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
