import type { Address } from '$lib/types';
import type { ComboboxItem } from '$lib/types/attributeCardTypes';

/** An address flattened from its GeoJSON feature envelope. */
export interface AddressRecord {
	uuid: string;
	id_address: string;
	id_address_2: string | null;
	street: string;
	housenumber: number | null;
	house_number_suffix: string;
	zip_code: string;
	city: string;
	district: string;
	status_development: { id: number; status: string } | null;
	flag: { id: number; flag: string } | null;
	project: { id?: number; project?: string } | null;
	geom_3857: { type?: string; coordinates?: number[] } | null;
}

/** One row of the paginated address list. */
export interface AddressListRow {
	value: string;
	id_address: string;
	street: string;
	housenumber: number | string;
	house_number_suffix: string;
	zip_code: string;
	city: string;
	district: string;
	status_development: string;
	flag: string;
}

/** A page of address rows plus the backend's pagination envelope. */
export interface AddressListPage {
	addresses: AddressListRow[];
	pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

/** A node the address is linked to. */
export interface LinkedNode {
	uuid: string;
	name: string;
	parentNodeName: string;
}

/** A microduct ending at one of the address's linked nodes. */
export type LinkedMicroduct = {
	uuid: string;
	number: number;
	color: string;
	colorHex: string;
	conduitName: string;
	conduitType: string;
	nodeName: string;
	nodeUuid: string;
	parentNodeName: string;
};

/** Nodes and microducts linked to an address. */
export interface AddressLinks {
	nodes: LinkedNode[];
	microducts: LinkedMicroduct[];
}

/** Editable address fields as sent by the detail form. */
export interface AddressPatchInput {
	street?: string;
	housenumber?: number | null;
	house_number_suffix?: string;
	zip_code?: string;
	city?: string;
	district?: string;
	status_development_id?: number | null;
	flag_id?: number | null;
	id_address?: string;
	id_address_2?: string | null;
}

const EMPTY_PAGINATION = { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 };

/**
 * Flattens a GeoJSON address feature (GeoFeatureModelSerializer output) into
 * a plain record with the feature id as `uuid`.
 * @param feature - The raw feature from the backend.
 */
export function normalizeAddress(feature: Address): AddressRecord {
	const props = (feature.properties ?? {}) as Record<string, unknown>;
	return {
		uuid: String(feature.id ?? props.uuid ?? ''),
		id_address: (props.id_address as string) ?? '',
		id_address_2: (props.id_address_2 as string | null) ?? null,
		street: (props.street as string) ?? '',
		housenumber: (props.housenumber as number | null) ?? null,
		house_number_suffix: (props.house_number_suffix as string) ?? '',
		zip_code: (props.zip_code as string) ?? '',
		city: (props.city as string) ?? '',
		district: (props.district as string) ?? '',
		status_development: (props.status_development as AddressRecord['status_development']) ?? null,
		flag: (props.flag as AddressRecord['flag']) ?? null,
		project: (props.project as AddressRecord['project']) ?? null,
		geom_3857: (props.geom_3857 as AddressRecord['geom_3857']) ?? null
	};
}

/**
 * Maps one lightweight list serializer item to a table row, defaulting
 * missing text fields to empty strings.
 * @param item - A result of `address/all/`.
 */
export function mapAddressListRow(item: Record<string, unknown>): AddressListRow {
	return {
		value: String(item.uuid ?? ''),
		id_address: (item.id_address as string) || '',
		street: (item.street as string) || '',
		housenumber: (item.housenumber as number | string | null | undefined) ?? '',
		house_number_suffix: (item.house_number_suffix as string) || '',
		zip_code: (item.zip_code as string) || '',
		city: (item.city as string) || '',
		district: (item.district as string) || '',
		status_development: (item.status_development as string) || '',
		flag: (item.flag as string) || ''
	};
}

/**
 * Maps the paginated `address/all/` payload to rows plus pagination.
 * @param payload - The backend page envelope.
 */
export function mapAddressListPage(payload: Record<string, unknown>): AddressListPage {
	const results = Array.isArray(payload.results)
		? (payload.results as Record<string, unknown>[])
		: [];
	return {
		addresses: results.map(mapAddressListRow),
		pagination: {
			page: (payload.page as number) || EMPTY_PAGINATION.page,
			pageSize: (payload.page_size as number) || EMPTY_PAGINATION.pageSize,
			totalCount: (payload.count as number) || EMPTY_PAGINATION.totalCount,
			totalPages: (payload.total_pages as number) || EMPTY_PAGINATION.totalPages
		}
	};
}

/**
 * Maps a backend attribute list to combobox options.
 * @param items - Attribute rows with an `id`.
 * @param labelKey - The row field holding the display label.
 */
export function toOptions(items: Record<string, unknown>[], labelKey: string): ComboboxItem[] {
	return items.map((item) => ({
		value: item.id as number,
		label: String(item[labelKey] ?? '')
	}));
}

/**
 * Maps a node feature collection (`node/?uuid_address=`) to linked nodes.
 * Accepts both a bare FeatureCollection and a paginated one.
 * @param payload - The raw node response body.
 */
export function mapLinkedNodes(payload: Record<string, unknown>): LinkedNode[] {
	const results = payload.results as Record<string, unknown> | undefined;
	const features = (payload.features ?? results?.features ?? []) as Record<string, unknown>[];
	return features.map((feature) => {
		const props = (feature.properties ?? {}) as Record<string, unknown>;
		const parent = props.parent_node as Record<string, unknown> | null | undefined;
		return {
			uuid: String(feature.id ?? props.uuid ?? ''),
			name: (props.name as string) || '',
			parentNodeName: (parent?.name as string) || ''
		};
	});
}

/**
 * Flattens the microducts of each linked node into display rows carrying
 * their node context.
 * @param node - The node the microducts end at.
 * @param microducts - Raw `microduct/all/?uuid_node=` items for that node.
 */
export function mapLinkedMicroducts(
	node: LinkedNode,
	microducts: Record<string, unknown>[]
): LinkedMicroduct[] {
	return microducts.map((md) => {
		const conduit = md.uuid_conduit as Record<string, unknown> | null | undefined;
		const conduitType = conduit?.conduit_type as Record<string, unknown> | null | undefined;
		return {
			uuid: String(md.uuid ?? ''),
			number: md.number as number,
			color: (md.color as string) || '',
			colorHex: (md.hex_code as string) || '#64748b',
			conduitName: (conduit?.name as string) || '',
			conduitType: (conduitType?.conduit_type as string) || '',
			nodeName: node.name,
			nodeUuid: node.uuid,
			parentNodeName: node.parentNodeName
		};
	});
}

/**
 * Builds the PATCH body for an address. Text fields are sent only when
 * non-empty; `id_address` is uppercased; `id_address_2` is sent whenever
 * provided (empty clears it) so the optional second id can be removed.
 * @param input - The form values.
 */
export function buildAddressPatch(input: AddressPatchInput): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (input.street) body.street = input.street;
	if (input.housenumber != null) body.housenumber = input.housenumber;
	if (input.zip_code) body.zip_code = input.zip_code;
	if (input.city) body.city = input.city;
	if (input.house_number_suffix) body.house_number_suffix = input.house_number_suffix;
	if (input.district) body.district = input.district;
	if (input.status_development_id) body.status_development_id = input.status_development_id;
	if (input.flag_id) body.flag_id = input.flag_id;
	if (input.id_address) body.id_address = input.id_address.toUpperCase();
	if (input.id_address_2 !== undefined) {
		body.id_address_2 = input.id_address_2 ? input.id_address_2.toUpperCase() : null;
	}
	return body;
}
