import type { ActionFailure, Cookies } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** Fetch all conduits/pipes in a trench */
export async function getPipesInTrench(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	trenchId: string
): Promise<Record<string, unknown> | ActionFailure<{ error: string }>> {
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

/** Fetch all microducts in a conduit/pipe */
export async function getMicroducts(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	pipeId: string
): Promise<Record<string, unknown> | ActionFailure<{ error: string }>> {
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

/** Fetch all trench UUIDs that contain a specific conduit */
export async function getTrenchesForConduit(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	conduitId: string
): Promise<Record<string, unknown> | ActionFailure<{ error: string }>> {
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

/** Fetch trench profile data (conduits with canvas positions) */
export async function getTrenchProfile(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	trenchUuid: string
): Promise<Record<string, unknown> | ActionFailure<{ error: string }>> {
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

/** Save canvas position for a conduit in trench profile */
export async function saveTrenchProfilePosition(
	fetch: typeof globalThis.fetch,
	cookies: Cookies,
	trenchUuid: string,
	conduitUuid: string,
	canvasX: number,
	canvasY: number,
	canvasWidth: number,
	canvasHeight: number
): Promise<Record<string, unknown> | ActionFailure<{ error: string }>> {
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
