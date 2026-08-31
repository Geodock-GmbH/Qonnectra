import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './_remote-auth';

/**
 * Fetch a cable's full detail record for the cable-details drawer.
 * @param uuid - Cable UUID.
 * @returns The cable detail object from the backend.
 * @throws When the backend request fails.
 */
export const getCableDetails = query(v.pipe(v.string(), v.nonEmpty()), async (uuid) => {
	const response = await fetch(`${API_URL}cable/${uuid}`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: Failed to load cable details`);
	}

	return (await response.json()) as Record<string, unknown>;
});
