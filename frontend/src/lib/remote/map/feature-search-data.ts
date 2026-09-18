import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { m } from '$lib/paraglide/messages';

import { failFromResponse } from '$lib/remote/shared/backend-error';

/** Feature kinds the map search can find. */
export type SearchableFeatureType = 'address' | 'node' | 'trench' | 'conduit' | 'area';

/** Feature kinds that carry their own geometry. */
export type GeometryFeatureType = Exclude<SearchableFeatureType, 'conduit'>;

export interface SearchResult {
	/** The feature UUID as a string */
	value: string;
	/** Display label for the search result */
	label: string;
	/** Type of the feature */
	type: SearchableFeatureType;
	/** The feature UUID */
	uuid: string;
	/** Optional name (for nodes, conduits, areas) */
	name?: string;
	/** Optional trench ID number (for trenches) */
	id_trench?: string;
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

interface AddressProperties {
	street?: string;
	housenumber?: string;
	house_number_suffix?: string;
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
	properties?: { name?: string; id_trench?: string };
}

interface ConduitSearchRow {
	uuid?: string;
	name?: string;
	conduit_type?: string;
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
 * Flattens the five search payloads into one result list with translated
 * type suffixes. Rows without an id or a display name are skipped.
 * @param payloads - Parsed bodies of the search endpoints.
 * @returns Search results in address, node, trench, conduit, area order.
 */
export function mapSearchResults(payloads: SearchPayloads): SearchResult[] {
	const results: SearchResult[] = [];

	for (const address of rowsOf<AddressSearchRow>(payloads.addresses)) {
		const props = address.properties ?? address;
		const addressId = address.properties ? address.id : address.uuid;
		if (!addressId) continue;
		const addressName = [props.street, props.housenumber, props.house_number_suffix]
			.filter(Boolean)
			.join(' ');
		results.push({
			value: addressId,
			label: `${addressName} (${m.form_address({ count: 1 })})`,
			type: 'address',
			uuid: addressId
		});
	}

	for (const node of rowsOf<NamedSearchFeature>(payloads.nodes)) {
		const name = node.properties?.name;
		if (!node.id || !name) continue;
		results.push({
			value: node.id,
			label: `${name} (${m.form_node()})`,
			type: 'node',
			uuid: node.id,
			name
		});
	}

	for (const trench of rowsOf<NamedSearchFeature>(payloads.trenches)) {
		const idTrench = trench.properties?.id_trench;
		if (!trench.id || !idTrench) continue;
		results.push({
			value: trench.id,
			label: `${idTrench} (${m.nav_trench()})`,
			type: 'trench',
			uuid: trench.id,
			id_trench: idTrench
		});
	}

	for (const conduit of rowsOf<ConduitSearchRow>(payloads.conduits)) {
		if (!conduit.uuid || !conduit.name) continue;
		const labelParts = [conduit.name];
		if (conduit.conduit_type) labelParts.push(`- ${conduit.conduit_type}`);
		labelParts.push(`(${m.form_conduit({ count: 1 })})`);
		results.push({
			value: conduit.uuid,
			label: labelParts.join(' '),
			type: 'conduit',
			uuid: conduit.uuid,
			name: conduit.name
		});
	}

	for (const area of rowsOf<NamedSearchFeature>(payloads.areas)) {
		const name = area.properties?.name;
		if (!area.id || !name) continue;
		results.push({
			value: area.id,
			label: `${name} (${m.form_area()})`,
			type: 'area',
			uuid: area.id,
			name
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
	if (failed) await failFromResponse(failed, 'Failed to fetch search results');

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
