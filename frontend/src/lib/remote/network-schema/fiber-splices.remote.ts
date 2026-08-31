import type { ComponentPort, FiberSplice } from '$lib/classes/FiberSpliceManager.svelte';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './remote-auth';

const UpsertSpliceSchema = v.object({
	nodeStructureUuid: v.pipe(v.string(), v.nonEmpty()),
	portNumber: v.number(),
	side: v.pipe(v.string(), v.nonEmpty()),
	fiberUuid: v.optional(v.string()),
	cableUuid: v.optional(v.string()),
	residentialUnitUuid: v.optional(v.string())
});

const ClearSpliceSchema = v.object({
	nodeStructureUuid: v.pipe(v.string(), v.nonEmpty()),
	portNumber: v.number(),
	side: v.pipe(v.string(), v.nonEmpty())
});

const MergePortsSchema = v.object({
	nodeStructureUuid: v.pipe(v.string(), v.nonEmpty()),
	portNumbers: v.array(v.number()),
	side: v.optional(v.string(), 'both')
});

const UnmergePortsSchema = v.object({
	mergeGroup: v.pipe(v.string(), v.nonEmpty()),
	portNumbers: v.array(v.number())
});

const UpsertMergedSchema = v.object({
	mergeGroup: v.pipe(v.string(), v.nonEmpty()),
	side: v.pipe(v.string(), v.nonEmpty()),
	fibers: v.array(v.record(v.string(), v.unknown()))
});

/**
 * Fetch the port definitions for a component type.
 * @param componentTypeId - Component type id (as a string).
 * @returns The component ports.
 * @throws When the backend request fails.
 */
export const getComponentPorts = query(
	v.pipe(v.string(), v.nonEmpty()),
	async (componentTypeId) => {
		const response = await fetch(
			`${API_URL}attributes_component_structure/?component_type=${componentTypeId}`,
			{ method: 'GET', headers: djangoHeaders() }
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to fetch component ports`
			);
		}

		return (await response.json()) as ComponentPort[];
	}
);

/**
 * Fetch the fiber splices of a node structure.
 * @param nodeStructureUuid - Node structure UUID.
 * @returns The fiber splices.
 * @throws When the backend request fails.
 */
export const getFiberSplices = query(
	v.pipe(v.string(), v.nonEmpty()),
	async (nodeStructureUuid) => {
		const response = await fetch(`${API_URL}fiber-splice/?node_structure=${nodeStructureUuid}`, {
			method: 'GET',
			headers: djangoHeaders()
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch fiber splices`);
		}

		return (await response.json()) as FiberSplice[];
	}
);

/**
 * Create or update the fiber (or residential unit) splice on a port.
 * @param input.nodeStructureUuid - Node structure UUID.
 * @param input.portNumber - Port number.
 * @param input.side - Port side.
 * @param input.fiberUuid - Fiber UUID (with cableUuid) for a fiber splice.
 * @param input.cableUuid - Cable UUID paired with fiberUuid.
 * @param input.residentialUnitUuid - Residential unit UUID for a RU splice.
 * @returns The created/updated splice.
 * @throws When required fields are missing or the backend rejects the write.
 */
export const upsertFiberSplice = command(
	UpsertSpliceSchema,
	async (input): Promise<FiberSplice> => {
		const hasFiber = Boolean(input.fiberUuid && input.cableUuid);
		if (!hasFiber && !input.residentialUnitUuid) {
			throw new Error('Either fiberUuid/cableUuid or residentialUnitUuid is required');
		}

		const requestBody: Record<string, unknown> = {
			node_structure: input.nodeStructureUuid,
			port_number: input.portNumber,
			side: input.side
		};
		if (hasFiber) {
			requestBody.fiber_uuid = input.fiberUuid;
			requestBody.cable_uuid = input.cableUuid;
		} else {
			requestBody.residential_unit_uuid = input.residentialUnitUuid;
		}

		const response = await fetch(`${API_URL}fiber-splice/upsert/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail ||
					errorData.error ||
					`HTTP ${response.status}: Failed to save fiber splice`
			);
		}

		return (await response.json()) as FiberSplice;
	}
);

/**
 * Create or update many fiber splices in one request.
 * @param splices - The splice payloads to upsert.
 * @returns The created splices and any failures.
 * @throws When the backend rejects the write.
 */
export const bulkUpsertFiberSplices = command(
	v.array(v.record(v.string(), v.unknown())),
	async (splices): Promise<{ created: FiberSplice[]; failed: unknown[] }> => {
		const response = await fetch(`${API_URL}fiber-splice/bulk-upsert/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({ splices })
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || errorData.error || `HTTP ${response.status}: Failed to create splices`
			);
		}

		const result = (await response.json()) as { created: FiberSplice[]; failed: unknown[] };
		return { created: result.created, failed: result.failed };
	}
);

/**
 * Clear the splice on a port.
 * @param input.nodeStructureUuid - Node structure UUID.
 * @param input.portNumber - Port number.
 * @param input.side - Port side.
 * @returns The number of deleted splices.
 * @throws When the backend rejects the write.
 */
export const clearFiberSplice = command(
	ClearSpliceSchema,
	async (input): Promise<{ deleted: number }> => {
		const response = await fetch(`${API_URL}fiber-splice/clear-port/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				node_structure: input.nodeStructureUuid,
				port_number: input.portNumber,
				side: input.side
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail ||
					errorData.error ||
					`HTTP ${response.status}: Failed to clear fiber splice`
			);
		}

		const result = (await response.json()) as { deleted: number };
		return { deleted: result.deleted };
	}
);

/**
 * Merge two or more ports of a node structure into one merge group.
 * @param input.nodeStructureUuid - Node structure UUID.
 * @param input.portNumbers - Ports to merge (>= 2).
 * @param input.side - Side to merge on (defaults to 'both').
 * @returns The backend merge result.
 * @throws When the backend rejects the write.
 */
export const mergePorts = command(
	MergePortsSchema,
	async (input): Promise<Record<string, unknown>> => {
		const response = await fetch(`${API_URL}fiber-splice/merge-ports/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				node_structure: input.nodeStructureUuid,
				port_numbers: input.portNumbers,
				side: input.side
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || errorData.error || `HTTP ${response.status}: Failed to merge ports`
			);
		}

		return (await response.json()) as Record<string, unknown>;
	}
);

/**
 * Split ports out of a merge group.
 * @param input.mergeGroup - Merge group id.
 * @param input.portNumbers - Ports to unmerge (>= 1).
 * @returns The backend unmerge result.
 * @throws When the backend rejects the write.
 */
export const unmergePorts = command(
	UnmergePortsSchema,
	async (input): Promise<Record<string, unknown>> => {
		const response = await fetch(`${API_URL}fiber-splice/unmerge-ports/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				merge_group: input.mergeGroup,
				port_numbers: input.portNumbers
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || errorData.error || `HTTP ${response.status}: Failed to unmerge ports`
			);
		}

		return (await response.json()) as Record<string, unknown>;
	}
);

/**
 * Connect fibers to a merged-port group on a side.
 * @param input.mergeGroup - Merge group id.
 * @param input.side - Side to connect.
 * @param input.fibers - Fiber payloads to connect.
 * @returns The backend result.
 * @throws When the backend rejects the write.
 */
export const upsertMergedSplice = command(
	UpsertMergedSchema,
	async (input): Promise<Record<string, unknown>> => {
		const response = await fetch(`${API_URL}fiber-splice/upsert-merged/`, {
			method: 'POST',
			headers: djangoHeaders(true),
			body: JSON.stringify({
				merge_group: input.mergeGroup,
				side: input.side,
				fibers: input.fibers
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail ||
					errorData.error ||
					`HTTP ${response.status}: Failed to connect fibers to merged ports`
			);
		}

		return (await response.json()) as Record<string, unknown>;
	}
);
