import type { CableData } from '$lib/classes/NetworkSchemaState.svelte';
import { command } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './remote-auth';

const WaypointSchema = v.object({
	x: v.number(),
	y: v.number()
});

const SaveGeometrySchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	diagramPath: v.array(WaypointSchema)
});

/**
 * Persist a cable's diagram path (waypoints) to the backend.
 * @param input.cableId - Cable UUID.
 * @param input.diagramPath - Full ordered waypoint list to store.
 * @returns The updated cable record from the backend.
 * @throws When the backend rejects the update.
 */
export const saveCableGeometry = command(SaveGeometrySchema, async ({ cableId, diagramPath }) => {
	const headers = djangoHeaders(true);

	const response = await fetch(`${API_URL}cable/${cableId}/`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify({ diagram_path: diagramPath })
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to update cable path`);
	}

	return (await response.json()) as CableData;
});
