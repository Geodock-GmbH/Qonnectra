/** Residential unit fields as entered in the create dialog. */
export interface ResidentialUnitCreateInput {
	id_residential_unit?: string;
	floor?: number | null;
	side?: string;
	building_section?: string;
	residential_unit_type_id?: number | null;
	status_id?: number | null;
	external_id_1?: string;
	external_id_2?: string;
	resident_name?: string;
	resident_recorded_date?: string;
	ready_for_service?: string;
}

/** Residential unit fields as edited on the detail page. */
export interface ResidentialUnitPatchInput {
	id_residential_unit?: string | null;
	floor?: number | null;
	side?: string | null;
	building_section?: string | null;
	residential_unit_type_id?: number | null;
	status_id?: number | null;
	external_id_1?: string | null;
	external_id_2?: string | null;
	resident_name?: string | null;
	resident_recorded_date?: string | null;
	ready_for_service?: string | null;
}

const NULLABLE_PATCH_FIELDS = [
	'id_residential_unit',
	'floor',
	'side',
	'building_section',
	'external_id_1',
	'external_id_2',
	'resident_name',
	'resident_recorded_date',
	'ready_for_service'
] as const;

/**
 * Builds the POST body for a new residential unit: the address link plus
 * every provided, non-empty field.
 * @param addressUuid - The owning address.
 * @param input - The dialog values.
 */
export function buildResidentialUnitCreateBody(
	addressUuid: string,
	input: ResidentialUnitCreateInput
): Record<string, unknown> {
	const body: Record<string, unknown> = { uuid_address_id: addressUuid };
	if (input.id_residential_unit) body.id_residential_unit = input.id_residential_unit;
	if (input.floor != null) body.floor = input.floor;
	if (input.side) body.side = input.side;
	if (input.building_section) body.building_section = input.building_section;
	if (input.residential_unit_type_id)
		body.residential_unit_type_id = input.residential_unit_type_id;
	if (input.status_id) body.status_id = input.status_id;
	if (input.external_id_1) body.external_id_1 = input.external_id_1;
	if (input.external_id_2) body.external_id_2 = input.external_id_2;
	if (input.resident_name) body.resident_name = input.resident_name;
	if (input.resident_recorded_date) body.resident_recorded_date = input.resident_recorded_date;
	if (input.ready_for_service) body.ready_for_service = input.ready_for_service;
	return body;
}

/**
 * Builds the PATCH body for a residential unit. Provided text/date fields are
 * sent as-is or `null` when emptied so the backend clears them; the type and
 * status ids are only sent when set.
 * @param input - The form values.
 */
export function buildResidentialUnitPatch(
	input: ResidentialUnitPatchInput
): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	for (const field of NULLABLE_PATCH_FIELDS) {
		const value = input[field];
		if (value === undefined) continue;
		body[field] = value === '' || value === null ? null : value;
	}
	if (input.residential_unit_type_id)
		body.residential_unit_type_id = input.residential_unit_type_id;
	if (input.status_id) body.status_id = input.status_id;
	return body;
}
