import type { GeoJSONFeature } from '$lib/remote/map/feature-search-data';

/** Feature kinds the map drawer can show, as named in `?feature=kind:uuid`. */
export const MAP_FEATURE_KINDS = ['trench', 'address', 'node', 'area'] as const;

export type MapFeatureKind = (typeof MAP_FEATURE_KINDS)[number];

type Properties = Record<string, unknown>;

/** Values the detail endpoint does not carry but the drawer shows. */
export interface DisplayExtras {
	/** Names of the conduits in a trench, aggregated by the tile layer today. */
	conduitNames?: string[];
}

/**
 * Reads an own property. `constructor` is a real attribute here, so plain
 * property access must not fall through to `Object.prototype`.
 */
function field(properties: Properties, key: string): unknown {
	return Object.hasOwn(properties, key) ? properties[key] : null;
}

/**
 * The label of a nested reference (`{ id, surface }` → `surface`); a scalar
 * passes through unchanged.
 */
function labelOf(value: unknown, key: string): unknown {
	if (value && typeof value === 'object') return field(value as Properties, key) ?? null;
	return value ?? null;
}

function companyOf(value: unknown): unknown {
	return labelOf(value, 'company');
}

/**
 * The project id as the attribute card expects it: a string matching the
 * project option values, from either a nested project or a bare id.
 */
function projectIdOf(value: unknown): string | null {
	const id = value && typeof value === 'object' ? field(value as Properties, 'id') : value;
	return id === null || id === undefined ? null : String(id);
}

/** One line for a node's address, from the nested address feature or record. */
function addressLineOf(value: unknown): string | null {
	if (!value || typeof value !== 'object') return null;
	const address = value as Properties;
	const props = (address.properties as Properties | undefined) ?? address;
	const line = [
		field(props, 'street'),
		[field(props, 'housenumber'), field(props, 'house_number_suffix')].filter(Boolean).join('')
	]
		.filter(Boolean)
		.join(' ');
	return line || null;
}

const DISPLAY: Record<MapFeatureKind, (p: Properties, extras: DisplayExtras) => Properties> = {
	trench: (p, { conduitNames }) => ({
		id_trench: field(p, 'id_trench'),
		project: projectIdOf(field(p, 'project')),
		construction_depth: field(p, 'construction_depth'),
		construction_details: field(p, 'construction_details'),
		internal_execution: field(p, 'internal_execution'),
		funding_status: field(p, 'funding_status'),
		date: field(p, 'date'),
		comment: field(p, 'comment'),
		house_connection: field(p, 'house_connection'),
		length: field(p, 'length'),
		owner: companyOf(field(p, 'owner')),
		constructor: companyOf(field(p, 'constructor')),
		construction_type: labelOf(field(p, 'construction_type'), 'construction_type'),
		phase: labelOf(field(p, 'phase'), 'phase'),
		status: labelOf(field(p, 'status'), 'status'),
		surface: labelOf(field(p, 'surface'), 'surface'),
		flag: labelOf(field(p, 'flag'), 'flag'),
		conduit_names: conduitNames?.length ? conduitNames.join(', ') : null
	}),
	address: (p) => ({
		id_address: field(p, 'id_address'),
		project: projectIdOf(field(p, 'project')),
		zip_code: field(p, 'zip_code'),
		city: field(p, 'city'),
		district: field(p, 'district'),
		street: field(p, 'street'),
		housenumber: field(p, 'housenumber'),
		house_number_suffix: field(p, 'house_number_suffix'),
		flag: labelOf(field(p, 'flag'), 'flag'),
		status: labelOf(field(p, 'status_development'), 'status')
	}),
	node: (p) => ({
		name: field(p, 'name'),
		project: projectIdOf(field(p, 'project')),
		warranty: field(p, 'warranty'),
		date: field(p, 'date'),
		owner: companyOf(field(p, 'owner')),
		constructor: companyOf(field(p, 'constructor')),
		manufacturer: companyOf(field(p, 'manufacturer')),
		flag: labelOf(field(p, 'flag'), 'flag'),
		network_level: labelOf(field(p, 'network_level'), 'network_level'),
		node_type: labelOf(field(p, 'node_type'), 'node_type'),
		status: labelOf(field(p, 'status'), 'status'),
		address: addressLineOf(field(p, 'uuid_address')),
		parent_node_name: labelOf(field(p, 'parent_node'), 'name')
	}),
	area: (p) => ({
		name: field(p, 'name'),
		project: projectIdOf(field(p, 'project')),
		area_type: labelOf(field(p, 'area_type'), 'area_type'),
		flag: labelOf(field(p, 'flag'), 'flag')
	})
};

/**
 * The attributes the drawer shows for a feature, flattened from the detail
 * endpoint's nested references to the same keys the tile layers carry, so
 * the field aliases keep applying. Empty values are left out.
 * @param kind - The feature kind.
 * @param properties - The `properties` of the fetched GeoJSON feature.
 * @param extras - Values fetched separately, such as a trench's conduit names.
 * @returns Display key to value, without nulls.
 */
export function displayProperties(
	kind: MapFeatureKind,
	properties: Properties,
	extras: DisplayExtras = {}
): Properties {
	return Object.fromEntries(
		Object.entries(DISPLAY[kind](properties, extras)).filter(
			([, value]) => value !== null && value !== undefined
		)
	);
}

/**
 * The drawer title of a feature: its identifier or name, or the full address
 * line of an address.
 * @param kind - The feature kind.
 * @param display - The flattened attributes from `displayProperties`.
 * @returns The title, or an empty string when the feature has no name yet.
 */
export function featureTitle(kind: MapFeatureKind, display: Properties): string {
	const text = (key: string) => {
		const value = field(display, key);
		return value === null || value === undefined ? '' : String(value);
	};
	switch (kind) {
		case 'trench':
			return text('id_trench');
		case 'address': {
			if (!text('street') || !text('housenumber')) return text('id_address');
			const number = `${text('housenumber')}${text('house_number_suffix')}`;
			return `${text('street')} ${number}, ${text('zip_code')} ${text('city')}`.trim();
		}
		case 'node':
		case 'area':
			return text('name');
	}
}

/**
 * The project a fetched feature belongs to, which in the global view can
 * differ from the current project.
 * @param feature - The fetched GeoJSON feature.
 * @returns The project id, or null when the payload names none.
 */
export function featureProjectId(feature: GeoJSONFeature): string | null {
	return projectIdOf(field(feature.properties, 'project'));
}

/** The address detail page a feature links to. */
export interface AddressLink {
	uuid: string;
	projectId: string;
}

/**
 * The address a feature leads to: an address itself, or the address linked
 * to a node. The project is the address's own, which in the global view can
 * differ from the current project.
 * @param kind - The feature kind.
 * @param feature - The fetched GeoJSON feature.
 * @returns The address uuid and project, or null when there is no address.
 */
export function addressLinkOf(kind: MapFeatureKind, feature: GeoJSONFeature): AddressLink | null {
	const address =
		kind === 'address'
			? feature
			: kind === 'node'
				? (field(feature.properties, 'uuid_address') as GeoJSONFeature | null)
				: null;
	const projectId = address?.id ? featureProjectId(address) : null;
	return address && projectId ? { uuid: address.id, projectId } : null;
}
