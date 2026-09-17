import type { ResidentialUnit } from '$lib/types';
import type { FiberConnection } from '$lib/utils/addressPdf';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { buildResidentialUnitCreateBody, buildResidentialUnitPatch } from './residential-unit-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const CreateUnitSchema = v.object({
	addressUuid: UuidSchema,
	id_residential_unit: v.optional(v.string()),
	floor: v.optional(v.nullable(v.number())),
	side: v.optional(v.string()),
	building_section: v.optional(v.string()),
	residential_unit_type_id: v.optional(v.nullable(v.number())),
	status_id: v.optional(v.nullable(v.number())),
	external_id_1: v.optional(v.string()),
	external_id_2: v.optional(v.string()),
	resident_name: v.optional(v.string()),
	resident_recorded_date: v.optional(v.string()),
	ready_for_service: v.optional(v.string())
});

const UpdateUnitSchema = v.object({
	unitUuid: UuidSchema,
	id_residential_unit: v.optional(v.nullable(v.string())),
	floor: v.optional(v.nullable(v.number())),
	side: v.optional(v.nullable(v.string())),
	building_section: v.optional(v.nullable(v.string())),
	residential_unit_type_id: v.optional(v.nullable(v.number())),
	status_id: v.optional(v.nullable(v.number())),
	external_id_1: v.optional(v.nullable(v.string())),
	external_id_2: v.optional(v.nullable(v.string())),
	resident_name: v.optional(v.nullable(v.string())),
	resident_recorded_date: v.optional(v.nullable(v.string())),
	ready_for_service: v.optional(v.nullable(v.string()))
});

const DeleteUnitSchema = v.object({
	unitUuid: UuidSchema,
	addressUuid: UuidSchema
});

/**
 * Fetch every residential unit of an address.
 * @param addressUuid - Address UUID.
 * @throws When the backend request fails.
 */
export const getResidentialUnits = query(
	UuidSchema,
	async (addressUuid): Promise<ResidentialUnit[]> => {
		const response = await fetch(
			`${API_URL}residential-unit/all/?uuid_address=${encodeURIComponent(addressUuid)}`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to fetch residential units');

		return (await response.json()) as ResidentialUnit[];
	}
);

/**
 * Fetch a single residential unit.
 * @param unitUuid - Residential unit UUID.
 * @throws When the backend request fails.
 */
export const getResidentialUnit = query(UuidSchema, async (unitUuid): Promise<ResidentialUnit> => {
	const response = await fetch(`${API_URL}residential-unit/${encodeURIComponent(unitUuid)}/`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch residential unit');

	return (await response.json()) as ResidentialUnit;
});

/**
 * Fetch the fiber connections spliced to a residential unit.
 * @param unitUuid - Residential unit UUID.
 * @throws When the backend request fails.
 */
export const getUnitFiberConnections = query(
	UuidSchema,
	async (unitUuid): Promise<FiberConnection[]> => {
		const response = await fetch(
			`${API_URL}residential-unit/${encodeURIComponent(unitUuid)}/fiber-connections/`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to fetch fiber connections');

		return (await response.json()) as FiberConnection[];
	}
);

/**
 * Create a residential unit for an address and refresh that address's unit list.
 * @param input.addressUuid - Owning address UUID.
 * @returns The created unit.
 * @throws When the backend rejects the create.
 */
export const createResidentialUnit = command(
	CreateUnitSchema,
	async ({ addressUuid, ...fields }): Promise<ResidentialUnit> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}residential-unit/`, {
			method: 'POST',
			headers,
			body: JSON.stringify(buildResidentialUnitCreateBody(addressUuid, fields))
		});
		if (!response.ok) await failFromResponse(response, 'Failed to create residential unit');

		void getResidentialUnits(addressUuid).refresh();
		return (await response.json()) as ResidentialUnit;
	}
);

/**
 * PATCH a residential unit's fields and push the result into `getResidentialUnit`.
 * @param input.unitUuid - Residential unit UUID.
 * @returns The updated unit.
 * @throws When the backend rejects the update.
 */
export const updateResidentialUnit = command(
	UpdateUnitSchema,
	async ({ unitUuid, ...fields }): Promise<ResidentialUnit> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}residential-unit/${encodeURIComponent(unitUuid)}/`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify(buildResidentialUnitPatch(fields))
		});
		if (!response.ok) await failFromResponse(response, 'Failed to update residential unit');

		const updated = (await response.json()) as ResidentialUnit;
		getResidentialUnit(unitUuid).set(updated);
		return updated;
	}
);

/**
 * Delete a residential unit and refresh its address's unit list.
 * @param input.unitUuid - Residential unit UUID.
 * @param input.addressUuid - Owning address UUID, used to refresh the list.
 * @throws When the backend rejects the delete.
 */
export const deleteResidentialUnit = command(
	DeleteUnitSchema,
	async ({ unitUuid, addressUuid }) => {
		const response = await fetch(`${API_URL}residential-unit/${encodeURIComponent(unitUuid)}/`, {
			method: 'DELETE',
			headers: djangoHeaders()
		});
		if (!response.ok) await failFromResponse(response, 'Failed to delete residential unit');

		void getResidentialUnits(addressUuid).refresh();
	}
);

/**
 * Ask the backend for a fresh unit id and push the result into `getResidentialUnit`.
 * @param unitUuid - Residential unit UUID.
 * @returns The updated unit.
 * @throws When the backend rejects the request.
 */
export const regenerateResidentialUnitId = command(
	UuidSchema,
	async (unitUuid): Promise<ResidentialUnit> => {
		const headers = djangoHeaders(true);
		const response = await fetch(
			`${API_URL}residential-unit/${encodeURIComponent(unitUuid)}/regenerate-id/`,
			{ method: 'POST', headers }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to regenerate residential unit ID');

		const updated = (await response.json()) as ResidentialUnit;
		getResidentialUnit(unitUuid).set(updated);
		return updated;
	}
);
