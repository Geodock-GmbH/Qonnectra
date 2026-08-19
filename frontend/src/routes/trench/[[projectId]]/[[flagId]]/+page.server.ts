import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { m } from '$lib/paraglide/messages';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';
import { getPipesInTrench, getTrenchesForConduit } from '$lib/server/conduitData';
import {
	getFeatureDetailsByType,
	getLayerExtent,
	getTrenchUuidsForConduit,
	searchFeaturesInProject
} from '$lib/server/featureSearch';

/** Loads conduit options and attribute types for the trench route. */
export const load: PageServerLoad = async ({ fetch, params, depends, cookies }) => {
	depends('app:conduits');
	const { projectId, flagId } = params;

	const [nodeTypesData, surfacesData, constructionTypesData, areaTypesData] = await Promise.all([
		getNodeTypes(fetch, cookies),
		getSurfaces(fetch, cookies),
		getConstructionTypes(fetch, cookies),
		getAreaTypes(fetch, cookies)
	]);

	if (!projectId || !flagId) {
		return {
			conduits: [],
			conduitsError: null,
			...nodeTypesData,
			...surfacesData,
			...constructionTypesData,
			...areaTypesData
		};
	}

	try {
		const url = `${API_URL}conduit/all/?project=${params.projectId}&flag=${params.flagId}&no_pagination=true`;
		const response = await fetch(url, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch conduits: ${response.status}`);
			return {
				conduits: [],
				conduitsError: m.title_error_fetching_conduits(),
				...nodeTypesData,
				...surfacesData,
				...constructionTypesData,
				...areaTypesData
			};
		}

		const data = await response.json();
		const conduitList = data.results || data;
		const conduits = conduitList.map((item: Record<string, unknown>) => ({
			value: item.uuid,
			label: item.name + ' (' + item.conduit_type + ')'
		}));
		return {
			conduits,
			conduitsError: null,
			...nodeTypesData,
			...surfacesData,
			...constructionTypesData,
			...areaTypesData
		};
	} catch (err) {
		console.error('Error fetching conduits:', err);
		return {
			conduits: [],
			conduitsError: m.title_error_fetching_conduits(),
			...nodeTypesData,
			...surfacesData,
			...constructionTypesData,
			...areaTypesData
		};
	}
};

export const actions = {
	/** Fetches trench geometry data by label. */
	getTrenchData: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const trenchLabel = data.get('trenchLabel');

		if (!trenchLabel) {
			throw error(400, 'Trench label is required');
		}

		try {
			const response = await fetch(`${API_URL}trench/?id_trench=${trenchLabel}`, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			});

			if (!response.ok) {
				throw error(response.status, 'Failed to fetch trench data');
			}

			const trenchData = await response.json();
			return { success: true, trenchData };
		} catch (err) {
			console.error('Error fetching trench data:', err);
			throw error(500, 'Failed to fetch trench data');
		}
	},

	/** Calculates a route between two trenches. */
	calculateRoute: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const startTrenchId = formData.get('startTrenchId');
		const endTrenchId = formData.get('endTrenchId');
		const projectId = formData.get('projectId');
		const tolerance = formData.get('tolerance');

		if (!startTrenchId || !endTrenchId || !projectId || tolerance === undefined) {
			return fail(400, {
				error:
					'Missing required parameters: startTrenchId, endTrenchId, projectId, and tolerance are required'
			});
		}

		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}routing/`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					start_trench_id: startTrenchId,
					end_trench_id: endTrenchId,
					project_id: [parseInt(String(projectId), 10)],
					tolerance: [parseFloat(String(tolerance))]
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorData;
				try {
					errorData = JSON.parse(errorText);
				} catch {
					const titleMatch = errorText.match(/<title>([^<]+)<\/title>/);
					const errorMessage = titleMatch
						? titleMatch[1].trim()
						: `Routing failed with status: ${response.status}`;
					errorData = { error: errorMessage };
				}
				console.error('Routing backend error:', response.status, errorData);
				return fail(response.status, errorData);
			}

			const routeData = await response.json();
			return { success: true, routeData };
		} catch (err) {
			console.error('Routing error:', err);
			return fail(500, { error: 'Internal server error during routing calculation' });
		}
	},

	/** Fetches all trench connections for a conduit. */
	getTrenchConnections: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitId = formData.get('conduitId');

		if (!conduitId) {
			return fail(400, { error: 'Conduit ID is required' });
		}

		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(
				`${API_URL}trench_conduit_connection/all/?uuid_conduit=${conduitId}`,
				{
					credentials: 'include',
					headers
				}
			);

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to fetch trench connections' });
			}

			const data = await response.json();
			const trenches = data.map((item: Record<string, unknown>) => ({
				value: item.uuid,
				label: (item.trench as Record<string, unknown>).properties
					? ((item.trench as Record<string, unknown>).properties as Record<string, unknown>)
							.id_trench
					: undefined,
				trench: (item.trench as Record<string, unknown>).id
			}));

			return { success: true, trenches };
		} catch (err) {
			console.error('Error fetching trench connections:', err);
			return fail(500, { error: 'Failed to fetch trench connections' });
		}
	},

	/** Deletes a trench connection by UUID. */
	deleteTrenchConnection: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const connectionId = formData.get('connectionId');

		if (!connectionId) {
			return fail(400, { error: 'Connection ID is required' });
		}

		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}trench_conduit_connection/${connectionId}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorText = await response.text();
				return fail(response.status, { error: errorText || 'Failed to delete connection' });
			}

			return { success: true };
		} catch (err) {
			console.error('Error deleting trench connection:', err);
			return fail(500, { error: 'Failed to delete trench connection' });
		}
	},

	/** Creates a new trench connection between a conduit and trench. */
	createTrenchConnection: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitId = formData.get('conduitId');
		const trenchId = formData.get('trenchId');

		if (!conduitId || !trenchId) {
			return fail(400, { error: 'Conduit ID and Trench ID are required' });
		}

		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}trench_conduit_connection/`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					uuid_conduit: conduitId,
					uuid_trench: trenchId
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				return fail(response.status, { error: errorText || 'Failed to create connection' });
			}

			const connection = await response.json();
			return { success: true, connection };
		} catch (err) {
			console.error('Error creating trench connection:', err);
			return fail(500, { error: 'Failed to create trench connection' });
		}
	},

	/** Searches for features in a project by query. */
	searchFeatures: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const searchQuery = String(data.get('searchQuery'));
		const projectId = String(data.get('projectId'));

		return searchFeaturesInProject(fetch, cookies, searchQuery, projectId);
	},

	/** Gets feature details by type and UUID. */
	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = String(data.get('featureType'));
		const featureUuid = String(data.get('featureUuid'));
		const projectId = String(data.get('projectId'));

		return getFeatureDetailsByType(
			fetch,
			cookies,
			featureType as 'trench' | 'node' | 'address' | 'area',
			featureUuid,
			projectId
		);
	},

	/** Gets all pipes/conduits in a specific trench. */
	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = String(formData.get('uuid'));

		return getPipesInTrench(fetch, cookies, trenchId);
	},

	/** Gets all trenches containing a specific conduit. */
	getTrenchesForConduit: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitId = String(formData.get('uuid'));

		return getTrenchesForConduit(fetch, cookies, conduitId);
	},

	/** Gets trench geometries for a conduit (for map highlighting). */
	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = String(formData.get('conduitUuid'));

		return getTrenchUuidsForConduit(fetch, cookies, conduitUuid);
	},

	/** Gets the bounding box extent for a layer type within a project. */
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = String(formData.get('layerType'));
		const projectId = String(formData.get('projectId'));

		return getLayerExtent(fetch, cookies, layerType as 'trench' | 'address' | 'node', projectId);
	}
} satisfies Actions;
