import type { Hierarchy } from '../../../routes/network-schema/[[projectId]]/components/containerItemTypes';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './remote-auth';

const CreateContainerSchema = v.object({
	nodeUuid: v.pipe(v.string(), v.nonEmpty()),
	containerTypeId: v.number(),
	name: v.optional(v.string()),
	parentContainerId: v.optional(v.string())
});

const UpdateContainerNameSchema = v.object({
	containerUuid: v.pipe(v.string(), v.nonEmpty()),
	name: v.optional(v.string())
});

const MoveItemSchema = v.object({
	itemType: v.picklist(['container', 'slot_configuration']),
	itemUuid: v.pipe(v.string(), v.nonEmpty()),
	targetContainerId: v.optional(v.string())
});

const CreateSlotConfigSchema = v.object({
	nodeUuid: v.pipe(v.string(), v.nonEmpty()),
	side: v.pipe(v.string(), v.nonEmpty()),
	totalSlots: v.pipe(v.number(), v.minValue(1))
});

const UpdateSlotConfigSchema = v.object({
	configUuid: v.pipe(v.string(), v.nonEmpty()),
	side: v.optional(v.string()),
	totalSlots: v.optional(v.number())
});

/**
 * Fetch the available container types for the node-structure panel.
 * @returns The container type list.
 * @throws When the backend request fails.
 */
export const getContainerTypes = query(async (): Promise<{ id: number; name: string }[]> => {
	const response = await fetch(`${API_URL}container-type/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: Failed to load container types`);
	}

	return (await response.json()) as { id: number; name: string }[];
});

/**
 * Fetch the full container/slot-configuration hierarchy for a node.
 * @param nodeUuid - Node UUID.
 * @returns The hierarchy tree.
 * @throws When the backend request fails.
 */
export const getContainerHierarchy = query(v.pipe(v.string(), v.nonEmpty()), async (nodeUuid) => {
	const response = await fetch(`${API_URL}container/tree/${nodeUuid}/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch hierarchy`);
	}

	return (await response.json()) as Hierarchy;
});

/**
 * Fetch the node structures attached to a slot configuration (used to warn
 * before deleting a configuration that would cascade-delete structures).
 * @param slotConfigUuid - Slot configuration UUID.
 * @returns The structure records.
 * @throws When the backend request fails.
 */
export const getNodeStructures = query(v.pipe(v.string(), v.nonEmpty()), async (slotConfigUuid) => {
	const response = await fetch(`${API_URL}node-structure/?slot_configuration=${slotConfigUuid}`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch node structures`);
	}

	return (await response.json()) as Record<string, unknown>[];
});

/**
 * Create a container under a node (optionally nested and named).
 * @param input.nodeUuid - Owning node UUID.
 * @param input.containerTypeId - Container type id.
 * @param input.name - Optional container name.
 * @param input.parentContainerId - Optional parent container for nesting.
 * @returns The created container record.
 * @throws When the backend rejects the create.
 */
export const createContainer = command(CreateContainerSchema, async (input) => {
	const headers = djangoHeaders(true);

	const requestBody: Record<string, unknown> = {
		uuid_node_id: input.nodeUuid,
		container_type_id: input.containerTypeId
	};
	if (input.name) requestBody.name = input.name;
	if (input.parentContainerId) requestBody.parent_container_id = input.parentContainerId;

	const response = await fetch(`${API_URL}container/`, {
		method: 'POST',
		headers,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to create container`);
	}

	return (await response.json()) as Record<string, unknown>;
});

/**
 * Delete a container.
 * @param containerUuid - Container UUID to delete.
 * @throws When the backend rejects the delete.
 */
export const deleteContainer = command(v.pipe(v.string(), v.nonEmpty()), async (containerUuid) => {
	const response = await fetch(`${API_URL}container/${containerUuid}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to delete container`);
	}
});

/**
 * Rename a container (an empty name clears it).
 * @param input.containerUuid - Container UUID.
 * @param input.name - New name, or empty to clear.
 * @returns The updated container record.
 * @throws When the backend rejects the update.
 */
export const updateContainerName = command(UpdateContainerNameSchema, async (input) => {
	const response = await fetch(`${API_URL}container/${input.containerUuid}/`, {
		method: 'PATCH',
		headers: djangoHeaders(true),
		body: JSON.stringify({ name: input.name || null })
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to update container name`);
	}

	return (await response.json()) as Record<string, unknown>;
});

/**
 * Move a container or slot configuration into a target container (or to root).
 * @param input.itemType - `container` or `slot_configuration`.
 * @param input.itemUuid - The item being moved.
 * @param input.targetContainerId - Destination container, or empty for root.
 * @throws When the backend rejects the move.
 */
export const moveItem = command(MoveItemSchema, async (input) => {
	const target = input.targetContainerId || null;
	const endpoint =
		input.itemType === 'container'
			? `${API_URL}container/${input.itemUuid}/move/`
			: `${API_URL}node-slot-configuration/${input.itemUuid}/move-to-container/`;
	const body =
		input.itemType === 'container' ? { parent_container_id: target } : { container_id: target };

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: djangoHeaders(true),
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || errorData.error || `HTTP ${response.status}: Failed to move item`
		);
	}
});

/**
 * Toggle a container's expanded state (reads the current value, then flips it).
 * @param containerUuid - Container UUID.
 * @throws When the backend request fails.
 */
export const toggleContainerExpanded = command(
	v.pipe(v.string(), v.nonEmpty()),
	async (containerUuid) => {
		const headers = djangoHeaders(true);

		const getResponse = await fetch(`${API_URL}container/${containerUuid}/`, {
			method: 'GET',
			headers: djangoHeaders()
		});
		if (!getResponse.ok) {
			throw new Error(`HTTP ${getResponse.status}: Container not found`);
		}
		const container = (await getResponse.json()) as { is_expanded?: boolean };

		const response = await fetch(`${API_URL}container/${containerUuid}/`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify({ is_expanded: !container.is_expanded })
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: Failed to update container`);
		}
	}
);

/**
 * Create a slot configuration on a node.
 * @param input.nodeUuid - Owning node UUID.
 * @param input.side - Configuration side label.
 * @param input.totalSlots - Number of slots (>= 1).
 * @returns The created configuration record.
 * @throws When the backend rejects the create.
 */
export const createSlotConfiguration = command(CreateSlotConfigSchema, async (input) => {
	const response = await fetch(`${API_URL}node-slot-configuration/`, {
		method: 'POST',
		headers: djangoHeaders(true),
		body: JSON.stringify({
			uuid_node_id: input.nodeUuid,
			side: input.side,
			total_slots: input.totalSlots
		})
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || `HTTP ${response.status}: Failed to create slot configuration`
		);
	}

	return (await response.json()) as Record<string, unknown>;
});

/**
 * Update a slot configuration's side and/or slot count.
 * @param input.configUuid - Configuration UUID.
 * @param input.side - New side label.
 * @param input.totalSlots - New slot count.
 * @returns The updated configuration record.
 * @throws When the backend rejects the update.
 */
export const updateSlotConfiguration = command(UpdateSlotConfigSchema, async (input) => {
	const requestBody: Record<string, unknown> = {};
	if (input.side) requestBody.side = input.side;
	if (input.totalSlots != null) requestBody.total_slots = input.totalSlots;

	const response = await fetch(`${API_URL}node-slot-configuration/${input.configUuid}/`, {
		method: 'PATCH',
		headers: djangoHeaders(true),
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || `HTTP ${response.status}: Failed to update slot configuration`
		);
	}

	return (await response.json()) as Record<string, unknown>;
});

/**
 * Delete a slot configuration (cascade-deletes its structures on the backend).
 * @param configUuid - Configuration UUID.
 * @throws When the backend rejects the delete.
 */
export const deleteSlotConfiguration = command(
	v.pipe(v.string(), v.nonEmpty()),
	async (configUuid) => {
		const response = await fetch(`${API_URL}node-slot-configuration/${configUuid}/`, {
			method: 'DELETE',
			headers: djangoHeaders()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to delete slot configuration`
			);
		}
	}
);

/**
 * Export a node's structure as an Excel file, returned base64-encoded.
 * @param nodeUuid - Node UUID.
 * @returns The base64 file data and its filename.
 * @throws When the export fails.
 */
export const exportNodeExcel = command(v.pipe(v.string(), v.nonEmpty()), async (nodeUuid) => {
	const response = await fetch(`${API_URL}node-export/excel/${nodeUuid}/`, {
		headers: djangoHeaders()
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: Export failed`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const base64 = Buffer.from(arrayBuffer).toString('base64');
	const contentDisposition = response.headers.get('Content-Disposition') || '';
	const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
	const fileName = fileNameMatch ? fileNameMatch[1] : 'structure.xlsx';

	return { fileData: base64, fileName };
});
