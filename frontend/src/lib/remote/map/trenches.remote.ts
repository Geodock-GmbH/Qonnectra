import type { TrenchCable, TrenchConduit, TrenchProfileConduit } from './trench-data';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const SaveProfilePositionSchema = v.object({
	trenchUuid: UuidSchema,
	conduitUuid: UuidSchema,
	x: v.number(),
	y: v.number(),
	width: v.number(),
	height: v.number()
});

/**
 * Fetch the conduits running through a trench.
 * @param trenchUuid - Trench UUID.
 * @returns The trench's conduit connections.
 * @throws When the backend request fails.
 */
export const getConduitsInTrench = query(
	UuidSchema,
	async (trenchUuid): Promise<TrenchConduit[]> => {
		const response = await fetch(
			`${API_URL}trench_conduit_connection/all/?uuid_trench=${encodeURIComponent(trenchUuid)}`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to get conduits in trench');

		return (await response.json()) as TrenchConduit[];
	}
);

/**
 * Fetch the cables passing through a trench.
 * @param trenchUuid - Trench UUID.
 * @returns The cables in the trench.
 * @throws When the backend request fails.
 */
export const getCablesInTrench = query(UuidSchema, async (trenchUuid): Promise<TrenchCable[]> => {
	const response = await fetch(`${API_URL}cable/in-trench/${encodeURIComponent(trenchUuid)}/`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to get cables in trench');

	return (await response.json()) as TrenchCable[];
});

/**
 * Fetch the cross-section of a trench: its conduits, their microducts and the
 * saved canvas placements.
 * @param trenchUuid - Trench UUID.
 * @returns The conduits of the trench profile.
 * @throws When the backend request fails.
 */
export const getTrenchProfile = query(
	UuidSchema,
	async (trenchUuid): Promise<TrenchProfileConduit[]> => {
		const response = await fetch(
			`${API_URL}trench-conduit-canvas/profile/${encodeURIComponent(trenchUuid)}/`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to get trench profile');

		const data: unknown = await response.json();
		return Array.isArray(data) ? (data as TrenchProfileConduit[]) : [];
	}
);

/**
 * Save where a conduit sits on the trench profile canvas.
 * @param input.trenchUuid - Trench the profile belongs to.
 * @param input.conduitUuid - Conduit that was moved or resized.
 * @param input.x - Canvas x position.
 * @param input.y - Canvas y position.
 * @param input.width - Canvas width.
 * @param input.height - Canvas height.
 * @throws When the backend rejects the placement.
 */
export const saveTrenchProfilePosition = command(
	SaveProfilePositionSchema,
	async ({ trenchUuid, conduitUuid, x, y, width, height }): Promise<void> => {
		const response = await fetch(`${API_URL}trench-conduit-canvas/bulk-save/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				trench: trenchUuid,
				positions: [
					{
						conduit: conduitUuid,
						canvas_x: x,
						canvas_y: y,
						canvas_width: width,
						canvas_height: height
					}
				]
			})
		});
		if (!response.ok) await failFromResponse(response, 'Failed to save position');
	}
);
