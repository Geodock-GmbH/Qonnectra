import type { AutoLinkResponse, MicropipeConnection } from '$lib/classes/NetworkSchemaState.svelte';
import { command } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { transformMicropipeConnections } from './micropipe-connections';
import { djangoHeaders } from './remote-auth';

const AutoLinkSchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	microductUuid: v.optional(v.string())
});

/**
 * Auto-link a cable to microducts matched via its end-node addresses. When a
 * `microductUuid` is supplied the backend links that specific microduct (used
 * to resolve an ambiguous end the user chose in a dialog).
 * @param input.cableId - Cable UUID.
 * @param input.microductUuid - Optional chosen microduct UUID.
 * @returns The backend auto-link result (per-end statuses and linked counts).
 * @throws When the backend rejects the link.
 */
export const autoLinkMicropipe = command(
	AutoLinkSchema,
	async ({ cableId, microductUuid }): Promise<AutoLinkResponse> => {
		const headers = djangoHeaders(true);

		const response = await fetch(`${API_URL}cables/${cableId}/auto-link-micropipe/`, {
			method: 'POST',
			headers,
			body: JSON.stringify(microductUuid ? { microduct_uuid: microductUuid } : {})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || errorData.error || `HTTP ${response.status}: Failed to auto-link micropipe`
			);
		}

		return (await response.json()) as AutoLinkResponse;
	}
);

/**
 * Fetch the microduct connections of a cable for dynamic edge coloring,
 * normalised to `{ number, color_hex, color_name }` entries.
 * @param cableId - Cable UUID.
 * @returns The transformed connection list.
 * @throws When the backend request fails.
 */
export const getMicropipeConnectionsForCable = command(
	v.pipe(v.string(), v.nonEmpty()),
	async (cableId): Promise<MicropipeConnection[]> => {
		const response = await fetch(
			`${API_URL}microduct_cable_connection/all/?uuid_cable=${cableId}`,
			{
				method: 'GET',
				headers: djangoHeaders()
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to fetch micropipe connections`
			);
		}

		const connections = (await response.json()) as Record<string, unknown>[];

		return transformMicropipeConnections(connections);
	}
);
