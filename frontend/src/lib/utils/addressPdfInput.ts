import type { AddressRecord } from '$lib/remote/address/address-data';
import type { ResidentialUnit } from '$lib/types';
import type {
	AddressData,
	FiberConnection,
	PdfLabels,
	ResidentialUnit as PdfResidentialUnit
} from '$lib/utils/addressPdf';

import { m } from '$lib/paraglide/messages';

/** Where the address lies, as printed in the PDF's location section. */
export interface PdfLocation {
	coordsDefault: string | null;
	coords4326: string | null;
	srid: number;
}

/**
 * Adapts an address record to the PDF generator's shape, dropping the nulls
 * the generator does not expect.
 * @param address - The address as returned by `getAddress`.
 * @param location - The formatted coordinates and their storage SRID.
 * @returns The address in the PDF generator's shape.
 */
export function toPdfAddress(address: AddressRecord, location: PdfLocation): AddressData {
	return {
		...address,
		housenumber: address.housenumber == null ? '' : String(address.housenumber),
		status_development: address.status_development ?? undefined,
		flag: address.flag ?? undefined,
		project: address.project?.project ? { project: address.project.project } : undefined,
		coordsDefault: location.coordsDefault ?? undefined,
		coords4326: location.coords4326 ?? undefined,
		srid: location.srid
	};
}

/**
 * Adapts an API residential unit to the PDF generator's shape, attaching
 * its fiber connections and dropping nulls the generator does not expect.
 * @param unit - The unit as returned by the backend.
 * @param fiberConnections - Connections keyed by unit uuid.
 * @returns The unit in the PDF generator's shape, with its fiber connections.
 */
export function toPdfUnit(
	unit: ResidentialUnit,
	fiberConnections: Record<string, FiberConnection[]>
): PdfResidentialUnit {
	return {
		id_residential_unit: unit.id_residential_unit ?? undefined,
		external_id_1: unit.external_id_1 ?? undefined,
		external_id_2: unit.external_id_2 ?? undefined,
		residential_unit_type: unit.residential_unit_type ?? undefined,
		status: unit.status ?? undefined,
		floor: unit.floor ?? undefined,
		side: unit.side ?? undefined,
		building_section: unit.building_section ?? undefined,
		resident_name: unit.resident_name ?? undefined,
		resident_recorded_date: unit.resident_recorded_date ?? undefined,
		ready_for_service: unit.ready_for_service ?? undefined,
		fiberConnections: fiberConnections[unit.uuid] ?? []
	};
}

/**
 * Builds the translated section and column titles of the address PDF.
 * @returns The labels in the active locale.
 */
export function addressPdfLabels(): PdfLabels {
	return {
		sectionAddressInformation: m.section_address_information(),
		sectionClassification: m.section_classification(),
		sectionLocation: m.section_location(),
		idAddress: m.form_id_address({ count: 1 }),
		street: m.form_street(),
		housenumber: m.form_housenumber(),
		zipCode: m.form_zip_code(),
		city: m.form_city(),
		district: m.form_district(),
		statusDevelopment: m.form_status_development(),
		flag: m.form_flag(),
		project: m.form_project({ count: 1 }),
		residentialUnit: m.section_residential_units({ count: 2 }),
		sectionIdentification: m.form_id_residential_unit(),
		sectionUnitLocation: m.section_location(),
		sectionResident: m.from_resident(),
		unitId: m.table_residential_unit_id(),
		unitType: m.table_residential_unit_type(),
		unitStatus: m.table_residential_unit_status(),
		floor: m.table_floor(),
		side: m.table_side(),
		buildingSection: m.form_building_section(),
		externalId1: m.form_external_id_1(),
		externalId2: m.form_external_id_2(),
		residentName: m.form_resident_name(),
		residentRecordedDate: m.form_resident_recorded_date(),
		readyForService: m.form_ready_for_service(),
		sectionMicroductConnections: m.section_microduct_connections(),
		tableParentNode: m.table_parent_node(),
		tableNode: m.table_node(),
		tableConduitName: m.table_conduit_name(),
		tableConduitType: m.table_conduit_type(),
		tableNumber: m.table_microduct_number(),
		tableColor: m.table_color(),
		sectionFiberConnections: m.section_fiber_connections(),
		tableCableName: m.table_cable_name(),
		tableFiberAbsolute: m.table_fiber_absolute(),
		tableBundle: m.table_bundle(),
		tableFiber: m.table_fiber(),
		sectionComment: m.pc_section_comment()
	};
}
