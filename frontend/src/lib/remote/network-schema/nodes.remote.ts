import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './remote-auth';

/**
 * Fetch a node's full detail record for the node-details drawer.
 * @param uuid - Node UUID.
 * @returns The node detail object from the backend.
 * @throws When the backend request fails.
 */
export const getNodeDetails = query(v.pipe(v.string(), v.nonEmpty()), async (uuid) => {
	const response = await fetch(`${API_URL}node/${uuid}`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: Failed to load node details`);
	}

	return (await response.json()) as Record<string, unknown>;
});
