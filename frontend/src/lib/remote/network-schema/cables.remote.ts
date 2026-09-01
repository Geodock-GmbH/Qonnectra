import type { CableData } from '$lib/classes/NetworkSchemaState.svelte';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { fetchCableSplices } from './cable-splices';
import { djangoHeaders } from './remote-auth';

const CreateCableSchema = v.object({
	uuid: v.optional(v.string()),
	name: v.pipe(v.string(), v.nonEmpty()),
	cableTypeId: v.number(),
	projectId: v.number(),
	flagId: v.number(),
	nodeStartId: v.pipe(v.string(), v.nonEmpty()),
	nodeEndId: v.pipe(v.string(), v.nonEmpty()),
	handleStart: v.optional(v.string()),
	handleEnd: v.optional(v.string()),
	parentNodeContextId: v.optional(v.string())
});

const UpdateCableSchema = v.object({
	cableId: v.pipe(v.string(), v.nonEmpty()),
	name: v.optional(v.string()),
	cableTypeId: v.optional(v.number()),
	statusId: v.optional(v.number()),
	networkLevelId: v.optional(v.number()),
	ownerId: v.optional(v.number()),
	constructorId: v.optional(v.number()),
	manufacturerId: v.optional(v.number()),
	flagId: v.optional(v.number()),
	date: v.optional(v.string()),
	reserveAtStart: v.optional(v.number()),
	reserveAtEnd: v.optional(v.number()),
	reserveSection: v.optional(v.number()),
	handleStart: v.optional(v.string()),
	handleEnd: v.optional(v.string())
});

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

/**
 * Create a Cable record connecting two nodes.
 * @param input.uuid - Optional client-generated UUID to reuse for the record.
 * @param input.name - Cable name.
 * @param input.cableTypeId - Cable type id.
 * @param input.projectId - Project id.
 * @param input.flagId - Flag id.
 * @param input.nodeStartId - Start node UUID.
 * @param input.nodeEndId - End node UUID.
 * @param input.handleStart - Optional start handle position.
 * @param input.handleEnd - Optional end handle position.
 * @param input.parentNodeContextId - Optional parent-node context for child views.
 * @returns The created cable record.
 * @throws When the backend rejects the create.
 */
export const createCable = command(CreateCableSchema, async (input): Promise<CableData> => {
	const headers = djangoHeaders(true);

	const requestBody: Record<string, unknown> = {
		name: input.name,
		cable_type_id: input.cableTypeId,
		project_id: input.projectId,
		flag_id: input.flagId,
		uuid_node_start_id: input.nodeStartId,
		uuid_node_end_id: input.nodeEndId
	};

	if (input.uuid) requestBody.uuid = input.uuid;
	if (input.handleStart) requestBody.handle_start = input.handleStart;
	if (input.handleEnd) requestBody.handle_end = input.handleEnd;
	if (input.parentNodeContextId) requestBody.parent_node_context_id = input.parentNodeContextId;

	const response = await fetch(`${API_URL}cable/`, {
		method: 'POST',
		headers,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || errorData.error || `HTTP ${response.status}: Failed to create cable`
		);
	}

	return (await response.json()) as CableData;
});

/**
 * Update a cable's attributes. Only provided fields are sent. Shared by the
 * cable attribute card (attributes/reserves) and the handle-config panel
 * (handle_start/handle_end).
 * @param input.cableId - Cable UUID to update.
 * @returns The updated cable record.
 * @throws When the backend rejects the update.
 */
export const updateCable = command(UpdateCableSchema, async (input): Promise<CableData> => {
	const headers = djangoHeaders(true);

	const requestBody: Record<string, unknown> = {};
	if (input.name) requestBody.name = input.name;
	if (input.cableTypeId != null) requestBody.cable_type_id = input.cableTypeId;
	if (input.statusId != null) requestBody.status_id = input.statusId;
	if (input.networkLevelId != null) requestBody.network_level_id = input.networkLevelId;
	if (input.ownerId != null) requestBody.owner_id = input.ownerId;
	if (input.constructorId != null) requestBody.constructor_id = input.constructorId;
	if (input.manufacturerId != null) requestBody.manufacturer_id = input.manufacturerId;
	if (input.flagId != null) requestBody.flag_id = input.flagId;
	if (input.date) requestBody.date = input.date;
	if (input.reserveAtStart != null) requestBody.reserve_at_start = input.reserveAtStart;
	if (input.reserveAtEnd != null) requestBody.reserve_at_end = input.reserveAtEnd;
	if (input.reserveSection != null) requestBody.reserve_section = input.reserveSection;
	if (input.handleStart) requestBody.handle_start = input.handleStart;
	if (input.handleEnd) requestBody.handle_end = input.handleEnd;

	const response = await fetch(`${API_URL}cable/${input.cableId}/`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to update cable`);
	}

	return (await response.json()) as CableData;
});

/**
 * Delete a cable.
 * @param cableId - Cable UUID to delete.
 * @throws When the backend rejects the delete.
 */
export const deleteCable = command(v.pipe(v.string(), v.nonEmpty()), async (cableId) => {
	const response = await fetch(`${API_URL}cable/${cableId}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to delete cable`);
	}
});

/**
 * Fetch the names of conduits a cable's microducts run through.
 * @param cableId - Cable UUID.
 * @returns The list of conduit names (may be empty).
 * @throws When the backend request fails.
 */
export const getConduitsForCable = query(v.pipe(v.string(), v.nonEmpty()), async (cableId) => {
	const response = await fetch(`${API_URL}cables/${cableId}/conduits/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch conduits`);
	}

	const data = (await response.json()) as { conduit_names?: string[] };
	return (data.conduit_names ?? []) as string[];
});

/**
 * Fetch the fiber splices connected to a cable (both sides), deduplicated.
 * @param cableUuid - Cable UUID.
 * @returns The deduplicated splice records.
 * @throws When the backend request fails.
 */
export const getCableSplices = query(v.pipe(v.string(), v.nonEmpty()), async (cableUuid) => {
	return fetchCableSplices(fetch, djangoHeaders(), API_URL, cableUuid);
});

/**
 * Trigger a server-side recalculation of a cable's routed length.
 * @param cableId - Cable UUID.
 * @returns The recomputed `length` and `length_total`.
 * @throws When the backend rejects the recalculation.
 */
export const recalculateCableLength = command(
	v.pipe(v.string(), v.nonEmpty()),
	async (cableId): Promise<{ length: number; length_total: number }> => {
		const response = await fetch(`${API_URL}cable/${cableId}/recalculate-length/`, {
			method: 'POST',
			headers: djangoHeaders()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to recalculate cable length`
			);
		}

		const data = (await response.json()) as { length: number; length_total: number };
		return { length: data.length, length_total: data.length_total };
	}
);
