import type { NodeStructure, SlotConfiguration } from '$lib/classes/NodeStructureContext.svelte';
import type { ClipNumberEntry, SlotDivider } from '$lib/classes/NodeStructureManager.svelte';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './remote-auth';

const CreateStructureSchema = v.object({
	nodeUuid: v.pipe(v.string(), v.nonEmpty()),
	slotConfigUuid: v.pipe(v.string(), v.nonEmpty()),
	slotStart: v.number(),
	slotEnd: v.number(),
	purpose: v.optional(v.string(), 'component'),
	componentTypeId: v.optional(v.number()),
	label: v.optional(v.string())
});

const BulkCreateStructuresSchema = v.object({
	nodeUuid: v.pipe(v.string(), v.nonEmpty()),
	slotConfigUuid: v.pipe(v.string(), v.nonEmpty()),
	componentTypeId: v.number(),
	slotStart: v.number(),
	count: v.number(),
	occupiedSlotsPerComponent: v.number()
});

const MoveStructureSchema = v.object({
	structureUuid: v.pipe(v.string(), v.nonEmpty()),
	slotStart: v.number()
});

const CreateDividerSchema = v.object({
	slotConfigUuid: v.pipe(v.string(), v.nonEmpty()),
	afterSlot: v.number()
});

const UpsertClipNumberSchema = v.object({
	slotConfigUuid: v.pipe(v.string(), v.nonEmpty()),
	slotNumber: v.number(),
	clipNumber: v.pipe(v.string(), v.nonEmpty())
});

/**
 * Fetch the slot configurations for a node.
 * @param nodeUuid - Node UUID.
 * @returns The slot configurations.
 * @throws When the backend request fails.
 */
export const getSlotConfigurationsForNode = query(
	v.pipe(v.string(), v.nonEmpty()),
	async (nodeUuid) => {
		const response = await fetch(`${API_URL}node-slot-configuration/by-node/${nodeUuid}/`, {
			method: 'GET',
			headers: djangoHeaders()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to fetch slot configurations`
			);
		}

		return (await response.json()) as SlotConfiguration[];
	}
);

/**
 * Fetch the slot dividers of a slot configuration.
 * @param slotConfigUuid - Slot configuration UUID.
 * @returns The dividers.
 * @throws When the backend request fails.
 */
export const getSlotDividers = query(v.pipe(v.string(), v.nonEmpty()), async (slotConfigUuid) => {
	const response = await fetch(
		`${API_URL}node-slot-divider/?slot_configuration=${slotConfigUuid}`,
		{
			method: 'GET',
			headers: djangoHeaders()
		}
	);

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch dividers`);
	}

	return (await response.json()) as SlotDivider[];
});

/**
 * Fetch the slot clip numbers of a slot configuration.
 * @param slotConfigUuid - Slot configuration UUID.
 * @returns The clip-number entries.
 * @throws When the backend request fails.
 */
export const getSlotClipNumbers = query(
	v.pipe(v.string(), v.nonEmpty()),
	async (slotConfigUuid) => {
		const response = await fetch(
			`${API_URL}node-slot-clip-number/?slot_configuration=${slotConfigUuid}`,
			{ method: 'GET', headers: djangoHeaders() }
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch clip numbers`);
		}

		return (await response.json()) as ClipNumberEntry[];
	}
);

/**
 * Create a node structure at a slot range.
 * @param input.nodeUuid - Owning node UUID.
 * @param input.slotConfigUuid - Slot configuration UUID.
 * @param input.slotStart - First slot.
 * @param input.slotEnd - Last slot.
 * @param input.purpose - Structure purpose (defaults to 'component').
 * @param input.componentTypeId - Optional component type id.
 * @param input.label - Optional label.
 * @returns The created structure.
 * @throws When the backend rejects the create.
 */
export const createNodeStructure = command(
	CreateStructureSchema,
	async (input): Promise<NodeStructure> => {
		const requestBody: Record<string, unknown> = {
			uuid_node_id: input.nodeUuid,
			slot_configuration_id: input.slotConfigUuid,
			slot_start: input.slotStart,
			slot_end: input.slotEnd,
			purpose: input.purpose
		};
		if (input.componentTypeId != null) requestBody.component_type_id = input.componentTypeId;
		if (input.label) requestBody.label = input.label;

		const response = await fetch(`${API_URL}node-structure/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || errorData.error || `HTTP ${response.status}: Failed to create structure`
			);
		}

		return (await response.json()) as NodeStructure;
	}
);

/**
 * Create several structures for one component type across consecutive slots.
 * @param input - Node/config, component type, start slot, count, slots-per-component.
 * @returns The created structures and any failed placements.
 * @throws When the backend rejects the create.
 */
export const bulkCreateNodeStructures = command(
	BulkCreateStructuresSchema,
	async (input): Promise<{ created: NodeStructure[]; failed: unknown[] }> => {
		const response = await fetch(`${API_URL}node-structure/bulk-create/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				node_uuid: input.nodeUuid,
				slot_configuration_uuid: input.slotConfigUuid,
				component_type_id: input.componentTypeId,
				slot_start: input.slotStart,
				count: input.count,
				occupied_slots_per_component: input.occupiedSlotsPerComponent
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || `HTTP ${response.status}: Failed to create structures`);
		}

		const result = (await response.json()) as { created: NodeStructure[]; failed: unknown[] };
		return { created: result.created, failed: result.failed };
	}
);

/**
 * Move a structure to a new starting slot.
 * @param input.structureUuid - Structure UUID.
 * @param input.slotStart - New start slot.
 * @returns The updated structure.
 * @throws When the backend rejects the move.
 */
export const moveNodeStructure = command(
	MoveStructureSchema,
	async (input): Promise<NodeStructure> => {
		const response = await fetch(`${API_URL}node-structure/${input.structureUuid}/move/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({ slot_start: input.slotStart })
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || errorData.error || `HTTP ${response.status}: Failed to move structure`
			);
		}

		return (await response.json()) as NodeStructure;
	}
);

/**
 * Delete a node structure.
 * @param structureUuid - Structure UUID.
 * @throws When the backend rejects the delete.
 */
export const deleteNodeStructure = command(
	v.pipe(v.string(), v.nonEmpty()),
	async (structureUuid) => {
		const response = await fetch(`${API_URL}node-structure/${structureUuid}/`, {
			method: 'DELETE',
			headers: djangoHeaders()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP ${response.status}: Failed to delete structure`);
		}
	}
);

/**
 * Create a slot divider after a given slot.
 * @param input.slotConfigUuid - Slot configuration UUID.
 * @param input.afterSlot - The slot the divider follows.
 * @returns The created divider.
 * @throws When the backend rejects the create.
 */
export const createSlotDivider = command(
	CreateDividerSchema,
	async (input): Promise<SlotDivider> => {
		const response = await fetch(`${API_URL}node-slot-divider/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				slot_configuration_id: input.slotConfigUuid,
				after_slot: input.afterSlot
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail ||
					errorData.after_slot?.[0] ||
					`HTTP ${response.status}: Failed to create divider`
			);
		}

		return (await response.json()) as SlotDivider;
	}
);

/**
 * Delete a slot divider.
 * @param dividerUuid - Divider UUID.
 * @throws When the backend rejects the delete.
 */
export const deleteSlotDivider = command(v.pipe(v.string(), v.nonEmpty()), async (dividerUuid) => {
	const response = await fetch(`${API_URL}node-slot-divider/${dividerUuid}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to delete divider`);
	}
});

/**
 * Create or update the clip number of a slot.
 * @param input.slotConfigUuid - Slot configuration UUID.
 * @param input.slotNumber - Slot number.
 * @param input.clipNumber - Clip number label.
 * @returns The upserted clip record.
 * @throws When the backend rejects the write.
 */
export const upsertSlotClipNumber = command(
	UpsertClipNumberSchema,
	async (input): Promise<Record<string, unknown>> => {
		const response = await fetch(`${API_URL}node-slot-clip-number/upsert/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				slot_configuration_id: input.slotConfigUuid,
				slot_number: input.slotNumber,
				clip_number: input.clipNumber
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || errorData.error || `HTTP ${response.status}: Failed to save clip number`
			);
		}

		return (await response.json()) as Record<string, unknown>;
	}
);
