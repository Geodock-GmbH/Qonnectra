import type { EdgeLabelData } from '$lib/classes/NetworkSchemaState.svelte';
import { command } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { withCableLock } from './cable-lock';

const UpsertLabelSchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	positionX: v.number(),
	positionY: v.number(),
	text: v.optional(v.string()),
	order: v.optional(v.number()),
	labelId: v.optional(v.string())
});

const DeleteLabelSchema = v.object({
	labelId: v.pipe(v.string(), v.nonEmpty())
});

/**
 * PATCH an existing cable label's text and position.
 * @param labelId - Label UUID to update.
 * @param body - Text and position payload.
 * @param headers - Django auth + JSON headers.
 * @returns The updated label.
 */
async function patchLabel(
	labelId: string,
	body: { text: string; position_x: number; position_y: number },
	headers: Record<string, string>
): Promise<EdgeLabelData> {
	const response = await fetch(`${API_URL}cable_label/${labelId}/`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify(body)
	});
	if (!response.ok) await failFromResponse(response, 'Failed to update cable label');
	return (await response.json()) as EdgeLabelData;
}

/**
 * Create or update a cable's label in a single call. When a `labelId` is known
 * this is a direct PATCH (race-free); otherwise it resolves the existing label
 * for the cable under a per-cable lock and PATCHes it, or POSTs a new one.
 * @param input.cableId - Cable UUID the label belongs to.
 * @param input.positionX - Label x position.
 * @param input.positionY - Label y position.
 * @param input.text - Label text (falls back to 'Label' on create).
 * @param input.order - Optional ordering index (defaults to 0 on create).
 * @param input.labelId - Known label UUID, when the caller already has one.
 * @returns The created or updated label record.
 * @throws When the backend rejects the write.
 */
export const upsertCableLabel = command(
	UpsertLabelSchema,
	async (input): Promise<EdgeLabelData> => {
		const headers = djangoHeaders(true);
		const text = input.text ?? 'Label';
		const body = { text, position_x: input.positionX, position_y: input.positionY };

		if (input.labelId) {
			return patchLabel(input.labelId, body, headers);
		}

		return withCableLock(input.cableId, async () => {
			const existingResponse = await fetch(`${API_URL}cable_label/?cable_uuid=${input.cableId}`, {
				method: 'GET',
				headers: djangoHeaders()
			});

			if (existingResponse.ok) {
				const existing = (await existingResponse.json()) as EdgeLabelData[];
				if (existing?.length > 0) {
					return patchLabel(existing[0].uuid, body, headers);
				}
			}

			const createResponse = await fetch(`${API_URL}cable_label/`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					cable_id: input.cableId,
					text,
					position_x: input.positionX,
					position_y: input.positionY,
					order: input.order ?? 0
				})
			});

			if (!createResponse.ok)
				await failFromResponse(createResponse, 'Failed to create cable label');

			return (await createResponse.json()) as EdgeLabelData;
		});
	}
);

/**
 * Delete a cable label.
 * @param input.labelId - Label UUID to delete.
 * @throws When the backend rejects the delete.
 */
export const deleteCableLabel = command(DeleteLabelSchema, async ({ labelId }) => {
	const response = await fetch(`${API_URL}cable_label/${labelId}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});

	if (!response.ok) await failFromResponse(response, 'Failed to delete cable label');
});
