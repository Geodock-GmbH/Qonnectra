import type { Cable, Fiber, NodeAddress } from '$lib/classes/CableFiberDataManager.svelte';
import type { ComponentPlacement, FiberColor } from '$lib/server/nodeData';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { djangoHeaders } from './remote-auth';

interface FiberStatusOption {
	id: number;
	fiber_status: string;
	name?: string;
}

const UpdateFiberStatusSchema = v.object({
	fiberUuid: v.pipe(v.string(), v.nonEmpty()),
	statusId: v.nullable(v.number())
});

/**
 * Fetch the cables connected at a node.
 * @param nodeUuid - Node UUID.
 * @returns The cables at the node.
 * @throws When the backend request fails.
 */
export const getCablesAtNode = query(v.pipe(v.string(), v.nonEmpty()), async (nodeUuid) => {
	const response = await fetch(`${API_URL}cable/at-node/${nodeUuid}/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch cables`);
	}

	return (await response.json()) as Cable[];
});

/**
 * Fetch the fibers of a cable.
 * @param cableUuid - Cable UUID.
 * @returns The cable's fibers.
 * @throws When the backend request fails.
 */
export const getFibersForCable = query(v.pipe(v.string(), v.nonEmpty()), async (cableUuid) => {
	const response = await fetch(`${API_URL}fiber/by-cable/${cableUuid}/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch fibers`);
	}

	return (await response.json()) as Fiber[];
});

/**
 * Fetch the fiber color palette.
 * @returns The fiber colors.
 * @throws When the backend request fails.
 */
export const getFiberColors = query(async (): Promise<FiberColor[]> => {
	const response = await fetch(`${API_URL}attributes_fiber_color/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: Failed to fetch fiber colors`);
	}

	return (await response.json()) as FiberColor[];
});

/**
 * Fetch which fibers are connected in a node, with their component placements.
 * @param nodeUuid - Node UUID.
 * @returns The used fiber UUIDs and a fiber-to-placement map.
 * @throws When the backend request fails.
 */
export const getFiberUsageInNode = query(v.pipe(v.string(), v.nonEmpty()), async (nodeUuid) => {
	const response = await fetch(`${API_URL}node/${nodeUuid}/used-fibers/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch fiber usage`);
	}

	const data = (await response.json()) as {
		used_uuids?: string[];
		fiber_component_map?: Record<string, ComponentPlacement>;
	};

	return {
		usedFiberUuids: (data.used_uuids ?? []) as string[],
		fiberComponentMap: (data.fiber_component_map ?? {}) as Record<string, ComponentPlacement>
	};
});

/**
 * Fetch a node's addresses with their residential units.
 * @param nodeUuid - Node UUID.
 * @returns The addresses.
 * @throws When the backend request fails.
 */
export const getAddressesForNode = query(v.pipe(v.string(), v.nonEmpty()), async (nodeUuid) => {
	const response = await fetch(`${API_URL}node/${nodeUuid}/addresses/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch addresses`);
	}

	const data = (await response.json()) as { addresses?: NodeAddress[] };
	return (data.addresses ?? []) as NodeAddress[];
});

/**
 * Fetch which residential units are connected in a node, with placements.
 * @param nodeUuid - Node UUID.
 * @returns The used residential-unit UUIDs and a unit-to-placement map.
 * @throws When the backend request fails.
 */
export const getUsedResidentialUnits = query(v.pipe(v.string(), v.nonEmpty()), async (nodeUuid) => {
	const response = await fetch(`${API_URL}node/${nodeUuid}/used-residential-units/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.detail || `HTTP ${response.status}: Failed to fetch used residential units`
		);
	}

	const data = (await response.json()) as {
		used_uuids?: string[];
		residential_unit_component_map?: Record<string, ComponentPlacement>;
	};

	return {
		usedResidentialUnitUuids: (data.used_uuids ?? []) as string[],
		residentialUnitComponentMap: (data.residential_unit_component_map ?? {}) as Record<
			string,
			ComponentPlacement
		>
	};
});

/**
 * Fetch the available fiber status options.
 * @returns The status options.
 * @throws When the backend request fails.
 */
export const getFiberStatusOptions = query(async (): Promise<FiberStatusOption[]> => {
	const response = await fetch(`${API_URL}attributes_fiber_status/`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: Failed to fetch fiber status options`);
	}

	return (await response.json()) as FiberStatusOption[];
});

/**
 * Update a fiber's status.
 * @param input.fiberUuid - Fiber UUID.
 * @param input.statusId - New status id, or null to clear.
 * @returns The updated fiber record.
 * @throws When the backend rejects the update.
 */
export const updateFiberStatus = command(
	UpdateFiberStatusSchema,
	async ({ fiberUuid, statusId }): Promise<Fiber> => {
		const response = await fetch(`${API_URL}fiber/${fiberUuid}/`, {
			method: 'PATCH',
			headers: djangoHeaders(true),
			body: JSON.stringify({ fiber_status_id: statusId })
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP ${response.status}: Failed to update fiber status`);
		}

		return (await response.json()) as Fiber;
	}
);
