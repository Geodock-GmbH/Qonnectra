import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { discardBodies } from '$lib/remote/shared/json';

/** Feature kinds the map search can find. */
export type SearchableFeatureType = 'address' | 'node' | 'trench' | 'conduit' | 'area';

/** Feature kinds that carry their own geometry. */
export type GeometryFeatureType = Exclude<SearchableFeatureType, 'conduit'>;

/** One map search hit, shaped as a combobox option. */
export interface SearchResult {
	/** The feature UUID as a string */
	value: string;
	/** The feature's own name: street address, node/conduit/area name or trench id */
	label: string;
	/** Type of the feature */
	type: SearchableFeatureType;
	/** The feature UUID */
	uuid: string;
	/** Context that tells same-named hits apart, joined with ` · `; empty when there is none */
	detail: string;
	/** Name of the feature's project; empty when the backend sent none */
	project: string;
}

/** A GeoJSON feature as served by the backend's feature endpoints. */
export type GeoJSONFeature = {
	id: string;
	type?: string;
	properties: Record<string, unknown>;
	geometry?: unknown;
};

/** Trenches a conduit runs through, with their geometries. */
export interface ConduitTrenches {
	trenches: GeoJSONFeature[];
	trenchUuids: string[];
}

/** A project as nested by the GeoJSON serializers, or flattened to its name by the list ones. */
type ProjectField = { project?: string } | string | null;

interface AddressProperties {
	street?: string;
	housenumber?: number | string | null;
	house_number_suffix?: string;
	zip_code?: string;
	city?: string;
	district?: string;
	project?: ProjectField;
}

interface AddressSearchRow extends AddressProperties {
	/** Address UUID (non-GeoJSON format) */
	uuid?: string;
	/** Address ID (GeoJSON format) */
	id?: string;
	/** GeoJSON properties */
	properties?: AddressProperties;
}

interface NamedSearchFeature {
	id?: string;
	properties?: {
		name?: string;
		id_trench?: string;
		project?: ProjectField;
		node_type?: { node_type?: string } | null;
		uuid_address?: { properties?: AddressProperties } | null;
		construction_type?: { construction_type?: string } | null;
		surface?: { surface?: string } | null;
		area_type?: { area_type?: string } | null;
	};
}

interface ConduitSearchRow {
	uuid?: string;
	name?: string;
	conduit_type?: string;
	network_level?: string;
	project?: ProjectField;
}

/** Raw payloads of the five search endpoints, in request order. */
export interface SearchPayloads {
	addresses: unknown;
	nodes: unknown;
	trenches: unknown;
	conduits: unknown;
	areas: unknown;
}

/**
 * Unwraps a list payload, which the backend serves as a GeoJSON collection,
 * a paginated envelope or a bare array depending on the endpoint.
 * @param payload - Parsed response body.
 * @returns The contained rows.
 */
function rowsOf<T>(payload: unknown): T[] {
	if (Array.isArray(payload)) return payload as T[];
	if (!payload || typeof payload !== 'object') return [];
	const { results, features } = payload as { results?: unknown; features?: unknown };
	if (Array.isArray(results)) return results as T[];
	if (Array.isArray(features)) return features as T[];
	return [];
}

/**
 * Formats street and house number as `Hauptstraße 5a`.
 * @param address - Address fields; any of them may be missing.
 * @returns The street address, or an empty string when it carries neither part.
 */
function formatStreetAddress(address: AddressProperties): string {
	const hasNumber = address.housenumber != null && address.housenumber !== '';
	const number = hasNumber ? `${address.housenumber}${address.house_number_suffix ?? ''}` : '';
	return [address.street, number].filter(Boolean).join(' ');
}

/**
 * Joins the non-empty context parts of a search hit.
 * @param parts - Context values in display order.
 * @returns The parts separated by ` · `.
 */
function joinDetail(...parts: (string | null | undefined)[]): string {
	return parts.filter(Boolean).join(' · ');
}

/**
 * Reads a project name from either serializer shape.
 * @param project - The nested project object or the flattened name.
 * @returns The project name, or an empty string when there is none.
 */
function projectName(project: ProjectField | undefined): string {
	if (typeof project === 'string') return project;
	return project?.project ?? '';
}

/**
 * Describes an address by its locality, adding the district when it differs
 * from the city.
 * @param address - Address fields.
 * @returns The context line.
 */
function addressDetail(address: AddressProperties): string {
	const locality = [address.zip_code, address.city].filter(Boolean).join(' ');
	const district = address.district !== address.city ? address.district : '';
	return joinDetail(locality, district);
}

/**
 * Describes a node by its type and linked address, leaving out the address
 * when the node name already spells it out.
 * @param name - The node name.
 * @param props - The node's GeoJSON properties.
 * @returns The context line.
 */
function nodeDetail(name: string, props: NonNullable<NamedSearchFeature['properties']>): string {
	const linkedAddress = formatStreetAddress(props.uuid_address?.properties ?? {});
	const isRedundant = name.toLowerCase().includes(linkedAddress.toLowerCase());
	return joinDetail(props.node_type?.node_type, isRedundant ? '' : linkedAddress);
}

/**
 * Flattens the five search payloads into one result list. Each hit carries
 * its own name plus a context line and project that tell same-named hits
 * apart. Rows without an id or a display name are skipped.
 * @param payloads - Parsed bodies of the search endpoints.
 * @returns Search results in address, node, trench, conduit, area order.
 */
export function mapSearchResults(payloads: SearchPayloads): SearchResult[] {
	const results: SearchResult[] = [];

	for (const address of rowsOf<AddressSearchRow>(payloads.addresses)) {
		const props = address.properties ?? address;
		const addressId = address.properties ? address.id : address.uuid;
		if (!addressId) continue;
		results.push({
			value: addressId,
			label: formatStreetAddress(props),
			type: 'address',
			uuid: addressId,
			detail: addressDetail(props),
			project: projectName(props.project)
		});
	}

	for (const node of rowsOf<NamedSearchFeature>(payloads.nodes)) {
		const props = node.properties ?? {};
		if (!node.id || !props.name) continue;
		results.push({
			value: node.id,
			label: props.name,
			type: 'node',
			uuid: node.id,
			detail: nodeDetail(props.name, props),
			project: projectName(props.project)
		});
	}

	for (const trench of rowsOf<NamedSearchFeature>(payloads.trenches)) {
		const props = trench.properties ?? {};
		if (!trench.id || !props.id_trench) continue;
		results.push({
			value: trench.id,
			label: props.id_trench,
			type: 'trench',
			uuid: trench.id,
			detail: joinDetail(props.construction_type?.construction_type, props.surface?.surface),
			project: projectName(props.project)
		});
	}

	for (const conduit of rowsOf<ConduitSearchRow>(payloads.conduits)) {
		if (!conduit.uuid || !conduit.name) continue;
		results.push({
			value: conduit.uuid,
			label: conduit.name,
			type: 'conduit',
			uuid: conduit.uuid,
			detail: joinDetail(conduit.conduit_type, conduit.network_level),
			project: projectName(conduit.project)
		});
	}

	for (const area of rowsOf<NamedSearchFeature>(payloads.areas)) {
		const props = area.properties ?? {};
		if (!area.id || !props.name) continue;
		results.push({
			value: area.id,
			label: props.name,
			type: 'area',
			uuid: area.id,
			detail: joinDetail(props.area_type?.area_type),
			project: projectName(props.project)
		});
	}

	return results;
}

/**
 * Picks the single feature out of a `?uuid=` lookup, which the backend serves
 * either as a paginated GeoJSON collection or as a bare array.
 * @param payload - Parsed response body.
 * @returns The feature, or `undefined` when the lookup matched nothing.
 */
export function firstFeature(payload: unknown): GeoJSONFeature | undefined {
	if (Array.isArray(payload)) return payload[0] as GeoJSONFeature | undefined;
	const features = (payload as { results?: { features?: GeoJSONFeature[] } } | null)?.results
		?.features;
	return features?.[0];
}

/**
 * Searches addresses, nodes, trenches, conduits and areas in parallel.
 * @param headers - Django auth headers.
 * @param searchQuery - The search term.
 * @param projectId - Project to scope the search to; empty searches all projects.
 * @returns The combined search results.
 * @throws When any of the backend requests fails.
 */
export async function searchFeaturesInProject(
	headers: Record<string, string>,
	searchQuery: string,
	projectId: string
): Promise<SearchResult[]> {
	const search = `search=${encodeURIComponent(searchQuery)}`;
	const project = projectId ? `&project=${encodeURIComponent(projectId)}` : '';

	const responses = await Promise.all(
		[
			`address/all/?${search}${project}`,
			`node/all/?${search}${project}&include_excluded=true`,
			`trench/all/?${search}${project}`,
			`conduit/all/?${search}${project}`,
			`area/all/?${search}${project}`
		].map((path) => fetch(`${API_URL}${path}`, { headers }))
	);

	const failed = responses.find((response) => !response.ok);
	if (failed) {
		await discardBodies(responses.filter((response) => response !== failed));
		await failFromResponse(failed, 'Failed to fetch search results');
	}

	const [addresses, nodes, trenches, conduits, areas] = await Promise.all(
		responses.map((response) => response.json() as Promise<unknown>)
	);

	return mapSearchResults({ addresses, nodes, trenches, conduits, areas });
}

/**
 * Fetches one feature with its geometry.
 * @param headers - Django auth headers.
 * @param featureType - Kind of feature to look up.
 * @param featureUuid - UUID of the feature.
 * @param projectId - Project to scope the lookup to; empty looks in all projects.
 * @returns The feature.
 * @throws With 404 when no feature matches, or when the backend request fails.
 */
export async function getFeatureDetailsByType(
	headers: Record<string, string>,
	featureType: GeometryFeatureType,
	featureUuid: string,
	projectId: string
): Promise<GeoJSONFeature> {
	const project = projectId ? `&project=${encodeURIComponent(projectId)}` : '';
	const response = await fetch(
		`${API_URL}${featureType}/?uuid=${encodeURIComponent(featureUuid)}${project}`,
		{ headers }
	);
	if (!response.ok) await failFromResponse(response, 'Failed to fetch feature details');

	const feature = firstFeature(await response.json());
	if (!feature) error(404, 'Feature not found');

	return feature;
}

/**
 * Fetches every trench a conduit runs through, including the geometries.
 * @param headers - Django auth headers.
 * @param conduitUuid - UUID of the conduit.
 * @returns The trench UUIDs and the trench features that could be resolved.
 * @throws When a backend request fails.
 */
export async function getTrenchesForConduit(
	headers: Record<string, string>,
	conduitUuid: string
): Promise<ConduitTrenches> {
	const response = await fetch(`${API_URL}conduit/${encodeURIComponent(conduitUuid)}/trenches/`, {
		headers
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch trenches for conduit');

	const { trench_uuids } = (await response.json()) as { trench_uuids?: string[] };
	const trenchUuids = trench_uuids ?? [];

	const trenchResponses = await Promise.all(
		trenchUuids.map((uuid) =>
			fetch(`${API_URL}trench/?uuid=${encodeURIComponent(uuid)}`, { headers })
		)
	);
	const failed = trenchResponses.find((trenchResponse) => !trenchResponse.ok);
	if (failed) await failFromResponse(failed, 'Failed to fetch trenches for conduit');

	const payloads = await Promise.all(
		trenchResponses.map((trenchResponse) => trenchResponse.json() as Promise<unknown>)
	);
	const trenches = payloads
		.map(firstFeature)
		.filter((feature): feature is GeoJSONFeature => feature !== undefined);

	return { trenches, trenchUuids };
}
