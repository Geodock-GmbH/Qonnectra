import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './remote-auth';

const SaveNodeGeometrySchema = v.object({
	nodeId: v.pipe(v.string(), v.nonEmpty()),
	x: v.number(),
	y: v.number(),
	// When true the coordinates target the node's position inside a parent's
	// child view (`child_canvas_x/y`) rather than the top-level canvas.
	isChildView: v.optional(v.boolean(), false)
});

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

/**
 * Persist a node's canvas position after a drag.
 * @param input.nodeId - Node UUID.
 * @param input.x - New x coordinate.
 * @param input.y - New y coordinate.
 * @param input.isChildView - When true, writes the child-view coordinates.
 * @returns The updated node record from the backend.
 * @throws When the backend rejects the update.
 */
export const saveNodeGeometry = command(
	SaveNodeGeometrySchema,
	async ({ nodeId, x, y, isChildView }) => {
		const headers = djangoHeaders(true);

		const updatePayload = isChildView
			? { child_canvas_x: x, child_canvas_y: y }
			: { canvas_x: x, canvas_y: y };

		const response = await fetch(`${API_URL}node/${nodeId}/`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify(updatePayload)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to update node position`
			);
		}

		return (await response.json()) as Record<string, unknown>;
	}
);
