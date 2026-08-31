import type { CableData } from '$lib/classes/NetworkSchemaState.svelte';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

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
