import type { Microduct, MicroductStatusOption } from './microduct-data';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const UpdateStatusSchema = v.object({
	uuid: UuidSchema,
	conduitUuid: UuidSchema,
	statusId: v.nullable(v.number())
});

/**
 * Fetch every microduct of a conduit.
 * @param conduitUuid - Conduit UUID.
 * @returns The conduit's microducts.
 * @throws When the backend request fails.
 */
export const getMicroducts = query(UuidSchema, async (conduitUuid): Promise<Microduct[]> => {
	const response = await fetch(
		`${API_URL}microduct/all/?uuid_conduit=${encodeURIComponent(conduitUuid)}`,
		{ headers: djangoHeaders() }
	);
	if (!response.ok) await failFromResponse(response, 'Failed to fetch microducts');

	return (await response.json()) as Microduct[];
});

/**
 * Microduct status options for the status combobox.
 * @returns The selectable microduct statuses.
 * @throws When the backend request fails.
 */
export const getMicroductStatusOptions = query(async (): Promise<MicroductStatusOption[]> => {
	const response = await fetch(`${API_URL}attributes_microduct_status/`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch status options');

	return (await response.json()) as MicroductStatusOption[];
});

/**
 * Set or clear a microduct's status and refresh its conduit's microduct list
 * in the same flight.
 * @param input.uuid - Microduct UUID.
 * @param input.conduitUuid - Owning conduit, whose `getMicroducts` instance is refreshed.
 * @param input.statusId - New status id, or `null` for healthy.
 * @returns The updated microduct.
 * @throws When the backend rejects the update.
 */
export const updateMicroductStatus = command(
	UpdateStatusSchema,
	async ({ uuid, conduitUuid, statusId }): Promise<Microduct> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}microduct/${encodeURIComponent(uuid)}/`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({ microduct_status_id: statusId })
		});
		if (!response.ok) await failFromResponse(response, 'Failed to update microduct status');

		const updated = (await response.json()) as Microduct;
		await getMicroducts(conduitUuid).refresh();
		return updated;
	}
);
