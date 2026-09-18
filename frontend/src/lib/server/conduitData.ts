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
