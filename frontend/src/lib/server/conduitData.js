import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Fetch all conduits/pipes in a trench
 * @param {typeof fetch} fetch - SvelteKit fetch
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies
 * @param {string} trenchId - UUID of the trench
 * @returns {Promise<Object>} The conduits data or failure response
 */
export async function getPipesInTrench(fetch, cookies, trenchId) {
	if (!trenchId) {
		return fail(400, { error: 'Trench ID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const backendUrl = `${API_URL}trench_conduit_connection/all/?uuid_trench=${trenchId}`;

		const response = await fetch(backendUrl, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to get pipes in trench' });
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error getting pipes in trench:', error);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Fetch all microducts in a conduit/pipe
 * @param {typeof fetch} fetch - SvelteKit fetch
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies
 * @param {string} pipeId - UUID of the conduit/pipe
 * @returns {Promise<Object>} The microducts data or failure response
 */
export async function getMicroducts(fetch, cookies, pipeId) {
	if (!pipeId) {
		return fail(400, { error: 'Pipe ID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const backendUrl = `${API_URL}microduct/all/?uuid_conduit=${pipeId}`;

		const response = await fetch(backendUrl, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to get microducts' });
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error getting microducts:', error);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Fetch all trench UUIDs that contain a specific conduit
 * @param {typeof fetch} fetch - SvelteKit fetch
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies
 * @param {string} conduitId - UUID of the conduit
 * @returns {Promise<Object>} The trench UUIDs data or failure response
 */
export async function getTrenchesForConduit(fetch, cookies, conduitId) {
	if (!conduitId) {
		return fail(400, { error: 'Conduit ID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const backendUrl = `${API_URL}conduit/${conduitId}/trenches/`;

		const response = await fetch(backendUrl, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to get trenches for conduit' });
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error getting trenches for conduit:', error);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Fetch trench profile data (conduits with canvas positions)
 * @param {typeof fetch} fetch - SvelteKit fetch
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies
 * @param {string} trenchUuid - UUID of the trench
 * @returns {Promise<Object>} The profile data or failure response
 */
export async function getTrenchProfile(fetch, cookies, trenchUuid) {
	if (!trenchUuid) {
		return fail(400, { error: 'Trench UUID is required' });
	}

	try {
		const headers = getAuthHeaders(cookies);
		const backendUrl = `${API_URL}trench-conduit-canvas/profile/${trenchUuid}/`;

		const response = await fetch(backendUrl, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to get trench profile' });
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error getting trench profile:', error);
		return fail(500, { error: 'Internal server error' });
	}
}

/**
 * Save canvas position for a conduit in trench profile
 * @param {typeof fetch} fetch - SvelteKit fetch
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies
 * @param {string} trenchUuid - UUID of the trench
 * @param {string} conduitUuid - UUID of the conduit
 * @param {number} canvasX - X position
 * @param {number} canvasY - Y position
 * @param {number} canvasWidth - Width
 * @param {number} canvasHeight - Height
 * @returns {Promise<Object>} The saved data or failure response
 */
export async function saveTrenchProfilePosition(
	fetch,
	cookies,
	trenchUuid,
	conduitUuid,
	canvasX,
	canvasY,
	canvasWidth,
	canvasHeight
) {
	try {
		const headers = getAuthHeaders(cookies);
		headers['Content-Type'] = 'application/json';

		const backendUrl = `${API_URL}trench-conduit-canvas/bulk-save/`;

		const response = await fetch(backendUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				trench: trenchUuid,
				positions: [
					{
						conduit: conduitUuid,
						canvas_x: canvasX,
						canvas_y: canvasY,
						canvas_width: canvasWidth,
						canvas_height: canvasHeight
					}
				]
			})
		});

		if (!response.ok) {
			return fail(response.status, { error: 'Failed to save position' });
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error('Error saving trench profile position:', error);
		return fail(500, { error: 'Internal server error' });
	}
}
