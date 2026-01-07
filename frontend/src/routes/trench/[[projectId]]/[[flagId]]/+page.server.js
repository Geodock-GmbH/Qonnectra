import { error, fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { m } from '$lib/paraglide/messages';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { getPipesInTrench, getTrenchesForConduit } from '$lib/server/conduitData';
import {
	getFeatureDetailsByType,
	getTrenchGeometriesForConduit,
	searchFeaturesInProject
} from '$lib/server/featureSearch';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, params, depends, cookies }) {
	depends('app:conduits');
	const { projectId, flagId } = params;

	if (!projectId || !flagId) {
		return { conduits: [], conduitsError: null };
	}

	try {
		let url = `${API_URL}conduit/all/?project=${params.projectId}&flag=${params.flagId}`;
		const response = await fetch(url, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch conduits: ${response.status}`);
			return { conduits: [], conduitsError: m.title_error_fetching_conduits() };
		}

		const data = await response.json();
		const conduits = data.map((item) => ({
			value: item.uuid,
			label: item.name
		}));
		return { conduits, conduitsError: null };
	} catch (error) {
		console.error('Error fetching conduits:', error);
		return { conduits: [], conduitsError: m.title_error_fetching_conduits() };
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * Fetches trench geometry data by label
	 * @type {import('./$types').Action}
	 */
	getTrenchData: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const trenchLabel = data.get('trenchLabel');

		if (!trenchLabel) {
			throw error(400, 'Trench label is required');
		}

		try {
			const response = await fetch(`${API_URL}ol_trench/?id_trench=${trenchLabel}`, {
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

	/**
	 * Calculates a route between two trenches
	 * @type {import('./$types').Action}
	 */
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
					start_trench_id: parseInt(startTrenchId, 10),
					end_trench_id: parseInt(endTrenchId, 10),
					project_id: [parseInt(projectId, 10)],
					tolerance: [parseFloat(tolerance)]
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

	/**
	 * Fetches all trench connections for a conduit
	 * @type {import('./$types').Action}
	 */
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
			const trenches = data.map((item) => ({
				value: item.uuid,
				label: item.trench.properties.id_trench,
				trench: item.trench.id
			}));

			return { success: true, trenches };
		} catch (err) {
			console.error('Error fetching trench connections:', err);
			return fail(500, { error: 'Failed to fetch trench connections' });
		}
	},

	/**
	 * Deletes a trench connection by UUID
	 * @type {import('./$types').Action}
	 */
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

	/**
	 * Creates a new trench connection between a conduit and trench
	 * @type {import('./$types').Action}
	 */
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

	/**
	 * Searches for features in a project by query
	 * @type {import('./$types').Action}
	 */
	searchFeatures: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const searchQuery = data.get('searchQuery');
		const projectId = data.get('projectId');

		return searchFeaturesInProject(fetch, cookies, searchQuery, projectId);
	},

	/**
	 * Gets feature details by type and UUID
	 * @type {import('./$types').Action}
	 */
	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = data.get('featureType');
		const featureUuid = data.get('featureUuid');

		return getFeatureDetailsByType(fetch, cookies, featureType, featureUuid);
	},

	/**
	 * Gets all pipes/conduits in a specific trench
	 * @type {import('./$types').Action}
	 */
	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = formData.get('uuid');

		return getPipesInTrench(fetch, cookies, trenchId);
	},

	/**
	 * Gets all trenches containing a specific conduit
	 * @type {import('./$types').Action}
	 */
	getTrenchesForConduit: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitId = formData.get('uuid');

		return getTrenchesForConduit(fetch, cookies, conduitId);
	},

	/**
	 * Gets trench geometries for a conduit (for map highlighting)
	 * @type {import('./$types').Action}
	 */
	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid');

		return getTrenchGeometriesForConduit(fetch, cookies, conduitUuid);
	}
};
