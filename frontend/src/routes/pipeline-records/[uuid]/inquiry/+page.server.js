import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';

/**
 * Loads the pipeline record, existing inquiry areas, and map attribute data.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ fetch, cookies, params }) {
	const headers = getAuthHeaders(cookies);
	const { uuid } = params;

	const [
		recordResponse,
		areasResponse,
		nodeTypesData,
		surfacesData,
		constructionTypesData,
		areaTypesData
	] = await Promise.all([
		fetch(`${API_URL}pipeline-records/${uuid}/`, {
			credentials: 'include',
			headers
		}),
		fetch(`${API_URL}pipeline-inquiry-areas/?pipeline_record=${uuid}`, {
			credentials: 'include',
			headers
		}),
		getNodeTypes(fetch, cookies),
		getSurfaces(fetch, cookies),
		getConstructionTypes(fetch, cookies),
		getAreaTypes(fetch, cookies)
	]);

	const inquiryAreas = areasResponse.ok ? await areasResponse.json() : { features: [] };

	return {
		recordExists: recordResponse.ok,
		inquiryAreas: inquiryAreas.features ?? [],
		...nodeTypesData,
		...surfacesData,
		...constructionTypesData,
		...areaTypesData
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * Saves a drawn polygon as a pipeline inquiry area.
	 * Expects form data: geojson (polygon geometry as GeoJSON string), name (optional).
	 */
	savePolygon: async ({ request, fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const geojson = String(formData.get('geojson') || '');
		const name = formData.get('name') ? String(formData.get('name')) : null;

		if (!geojson) {
			return fail(400, { message: 'Polygon geometry is required' });
		}

		let geometry;
		try {
			geometry = JSON.parse(geojson);
		} catch {
			return fail(400, { message: 'Invalid GeoJSON' });
		}

		try {
			const response = await fetch(`${API_URL}pipeline-inquiry-areas/`, {
				method: 'POST',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					pipeline_record: params.uuid,
					name,
					geom: geometry
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to save polygon'
				});
			}

			const saved = await response.json();
			return { success: true, polygon: saved };
		} catch (/** @type {any} */ err) {
			console.error('Error saving inquiry polygon:', err);
			return fail(500, { message: err.message || 'Failed to save polygon' });
		}
	},

	/**
	 * Updates a pipeline inquiry area geometry via PATCH.
	 * Expects form data: polygonUuid, geojson (geometry as GeoJSON string).
	 */
	updatePolygon: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const polygonUuid = String(formData.get('polygonUuid') || '');
		const geojson = String(formData.get('geojson') || '');

		if (!polygonUuid) {
			return fail(400, { message: 'Polygon UUID is required' });
		}
		if (!geojson) {
			return fail(400, { message: 'Polygon geometry is required' });
		}

		let geometry;
		try {
			geometry = JSON.parse(geojson);
		} catch {
			return fail(400, { message: 'Invalid GeoJSON' });
		}

		try {
			const response = await fetch(`${API_URL}pipeline-inquiry-areas/${polygonUuid}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					type: 'Feature',
					geometry,
					properties: {}
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to update polygon'
				});
			}

			const updated = await response.json();
			return { success: true, polygon: updated };
		} catch (/** @type {any} */ err) {
			console.error('Error updating inquiry polygon:', err);
			return fail(500, { message: err.message || 'Failed to update polygon' });
		}
	},

	/**
	 * Renames a pipeline inquiry area via PATCH.
	 * Expects form data: polygonUuid, name.
	 */
	renamePolygon: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const polygonUuid = String(formData.get('polygonUuid') || '');
		const name = String(formData.get('name') || '').trim();

		if (!polygonUuid) {
			return fail(400, { message: 'Polygon UUID is required' });
		}
		if (!name) {
			return fail(400, { message: 'Name is required' });
		}

		try {
			const response = await fetch(`${API_URL}pipeline-inquiry-areas/${polygonUuid}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					type: 'Feature',
					properties: { name }
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to rename polygon'
				});
			}

			const updated = await response.json();
			return { success: true, polygon: updated };
		} catch (/** @type {any} */ err) {
			console.error('Error renaming inquiry polygon:', err);
			return fail(500, { message: err.message || 'Failed to rename polygon' });
		}
	},

	/**
	 * Deletes a pipeline inquiry area by UUID.
	 * Expects form data: polygonUuid.
	 */
	deletePolygon: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const polygonUuid = String(formData.get('polygonUuid') || '');

		if (!polygonUuid) {
			return fail(400, { message: 'Polygon UUID is required' });
		}

		try {
			const response = await fetch(`${API_URL}pipeline-inquiry-areas/${polygonUuid}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to delete polygon'
				});
			}

			return { success: true, deleted: polygonUuid };
		} catch (/** @type {any} */ err) {
			console.error('Error deleting inquiry polygon:', err);
			return fail(500, { message: err.message || 'Failed to delete polygon' });
		}
	}
};
