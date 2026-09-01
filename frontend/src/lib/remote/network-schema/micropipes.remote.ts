import type { Conduit, Micropipe } from '$lib/classes/CableMicropipeManager.svelte';
import type { AutoLinkResponse, MicropipeConnection } from '$lib/classes/NetworkSchemaState.svelte';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { transformMicropipeConnections } from './micropipe-connections';
import { djangoHeaders } from './remote-auth';

const AutoLinkSchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	microductUuid: v.optional(v.string())
});

const ConduitsByTrenchesSchema = v.object({
	trenchIds: v.array(v.string()),
	cableId: v.optional(v.string())
});

const MicropipesByConduitsSchema = v.object({
	conduitIds: v.array(v.string()),
	cableId: v.optional(v.string())
});

const CreateConnectionsSchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	micropipeNumber: v.number(),
	color: v.pipe(v.string(), v.nonEmpty()),
	conduitIds: v.array(v.string())
});

const DeleteConnectionsSchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	micropipeNumber: v.number(),
	conduitIds: v.array(v.string())
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
				errorData.detail ||
					errorData.error ||
					`HTTP ${response.status}: Failed to auto-link micropipe`
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

/**
 * Fetch the trench UUIDs where a cable already has micropipe connections.
 * @param cableId - Cable UUID.
 * @returns The linked trench UUIDs.
 * @throws When the backend request fails.
 */
export const getLinkedTrenchesForCable = query(
	v.pipe(v.string(), v.nonEmpty()),
	async (cableId): Promise<string[]> => {
		const response = await fetch(`${API_URL}cables/${cableId}/linked-trenches/`, {
			method: 'GET',
			headers: djangoHeaders()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to fetch linked trenches`
			);
		}

		const data = (await response.json()) as { trench_uuids?: string[] };
		return data.trench_uuids ?? [];
	}
);

/**
 * Fetch the conduits running through the given trenches (optionally annotated
 * with linkage status for a cable).
 * @param input.trenchIds - Trench UUIDs to inspect.
 * @param input.cableId - Optional cable UUID for linkage annotation.
 * @returns The conduit list (empty when no trenches are given).
 * @throws When the backend request fails.
 */
export const getConduitsByTrenches = query(
	ConduitsByTrenchesSchema,
	async ({ trenchIds, cableId }): Promise<Conduit[]> => {
		if (trenchIds.length === 0) return [];
		const headers = djangoHeaders();

		let url = `${API_URL}conduits/by-trenches/?trench_ids=${encodeURIComponent(trenchIds.join(','))}`;
		if (cableId) url += `&cable_id=${encodeURIComponent(cableId)}`;

		const response = await fetch(url, { method: 'GET', headers });

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch conduits`);
		}

		return (await response.json()) as Conduit[];
	}
);

/**
 * Fetch the micropipes available in the given conduits (optionally annotated
 * with linkage status for a cable).
 * @param input.conduitIds - Conduit UUIDs to inspect.
 * @param input.cableId - Optional cable UUID for linkage annotation.
 * @returns The micropipe list (empty when no conduits are given).
 * @throws When the backend request fails.
 */
export const getMicropipesByConduits = query(
	MicropipesByConduitsSchema,
	async ({ conduitIds, cableId }): Promise<Micropipe[]> => {
		if (conduitIds.length === 0) return [];
		const headers = djangoHeaders();

		let url = `${API_URL}micropipes/by-conduits/?conduit_ids=${encodeURIComponent(conduitIds.join(','))}`;
		if (cableId) url += `&cable_id=${encodeURIComponent(cableId)}`;

		const response = await fetch(url, { method: 'GET', headers });

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch micropipes`);
		}

		return (await response.json()) as Micropipe[];
	}
);

/**
 * Link a micropipe (by number + color) to a cable across the given conduits.
 * @param input.cableId - Cable UUID.
 * @param input.micropipeNumber - Micropipe number to link.
 * @param input.color - Micropipe color name.
 * @param input.conduitIds - Conduits the linkage spans.
 * @throws When the backend rejects the create.
 */
export const createMicropipeConnections = command(CreateConnectionsSchema, async (input) => {
	const response = await fetch(`${API_URL}cables/${input.cableId}/micropipe-connections/`, {
		method: 'POST',
		headers: djangoHeaders(true),
		body: JSON.stringify({
			micropipe_number: input.micropipeNumber,
			color: input.color,
			conduit_ids: input.conduitIds
		})
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || errorData.error || `HTTP ${response.status}: Failed to create connections`
		);
	}
});

/**
 * Remove a micropipe linkage from a cable across the given conduits.
 * @param input.cableId - Cable UUID.
 * @param input.micropipeNumber - Micropipe number to unlink.
 * @param input.conduitIds - Conduits the linkage spans.
 * @throws When the backend rejects the delete.
 */
export const deleteMicropipeConnections = command(DeleteConnectionsSchema, async (input) => {
	const response = await fetch(`${API_URL}cables/${input.cableId}/micropipe-connections/`, {
		method: 'DELETE',
		headers: djangoHeaders(true),
		body: JSON.stringify({
			micropipe_number: input.micropipeNumber,
			conduit_ids: input.conduitIds
		})
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || errorData.error || `HTTP ${response.status}: Failed to delete connections`
		);
	}
});
