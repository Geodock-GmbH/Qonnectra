import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Loads fiber trace data for a given cable.
 * @param {import('./$types').PageServerLoadEvent} event
 * @returns {Promise<{result?: Object, error?: string, entryType: string, entryId: string, options?: {includeGeometry: boolean, geometryMode: string, orientGeometry: boolean}}>}
 */
export async function load({ fetch, cookies, params, url }) {
	const { uuid } = params;
	const includeGeometry = url.searchParams.get('include_geometry') === 'true';
	const geometryMode = url.searchParams.get('geometry_mode') || 'segments';
	const orientGeometry = url.searchParams.get('orient_geometry') === 'true';

	const headers = getAuthHeaders(cookies);

	let apiUrl = `${API_URL}fiber-trace/?cable_id=${uuid}&include_geometry=${includeGeometry}`;
	if (includeGeometry) {
		apiUrl += `&geometry_mode=${geometryMode}&orient_geometry=${orientGeometry}`;
	}

	try {
		const response = await fetch(apiUrl, { method: 'GET', headers });

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				error: errorData.error || 'Trace failed',
				entryType: 'cable',
				entryId: uuid
			};
		}

		const result = await response.json();
		return {
			result,
			entryType: 'cable',
			entryId: uuid,
			options: { includeGeometry, geometryMode, orientGeometry }
		};
	} catch (err) {
		console.error('Trace error:', err);
		return {
			error: 'Internal server error',
			entryType: 'cable',
			entryId: uuid
		};
	}
}
