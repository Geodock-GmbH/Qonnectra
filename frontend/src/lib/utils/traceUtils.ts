import type { TraceEntryType } from '$lib/remote/trace/trace-data';
import type {
	CableInfrastructure,
	EndpointNode,
	GeoJSONGeometry,
	TraceResult,
	TraceTreeNode
} from '$lib/types/trace';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

import { TRACE_ENTRY_TYPES } from '$lib/remote/trace/trace-data';

interface GeoJSONFeatureProperties {
	feature_type: string;
	[key: string]: unknown;
}

interface GeoJSONFeature {
	type: 'Feature';
	properties: GeoJSONFeatureProperties;
	geometry: GeoJSONGeometry;
}

interface CRS {
	type: 'name';
	properties: { name: string };
}

export interface GeoJSONFeatureCollection {
	type: 'FeatureCollection';
	name: string;
	crs: CRS;
	features: GeoJSONFeature[];
}

/** App-relative path of an entity's trace page. */
export type TraceEntryPath = `/trace/${string}/${string}`;

/**
 * Builds the path of the trace page for an entity. Entry types are spelled
 * with hyphens in the URL.
 * @param type - Entity type the trace starts from.
 * @param id - Entity UUID.
 * @returns The app-relative path.
 */
export function traceEntryPath(type: TraceEntryType, id: string): TraceEntryPath {
	return `/trace/${type.replaceAll('_', '-')}/${id}`;
}

/**
 * Reads the entry type out of a trace page's URL segment.
 * @param slug - The URL segment, e.g. `residential-unit`.
 * @returns The entry type, or `null` when the segment names none.
 */
export function traceEntryTypeFromSlug(slug: string): TraceEntryType | null {
	return TRACE_ENTRY_TYPES.find((type) => type.replaceAll('_', '-') === slug) ?? null;
}

/**
 * Navigates to the trace page for a given entity.
 * @param type - Entity type the trace starts from.
 * @param id - Entity UUID
 */
export function traceFrom(type: TraceEntryType, id: string): void {
	goto(resolve(traceEntryPath(type, id)));
}

/**
 * Properties every line feature of a cable shares.
 * @param cableId - UUID of the cable.
 * @param infra - The cable's infrastructure.
 * @returns The cable id plus its conduit and microduct.
 */
function cableProperties(cableId: string, infra: CableInfrastructure): Record<string, unknown> {
	return {
		cable_id: cableId,
		conduit_name: infra.conduit?.name || null,
		conduit_type: infra.conduit?.type || null,
		microduct_number: infra.microduct?.number || null,
		microduct_color: infra.microduct?.color || null
	};
}

/**
 * Builds the line features of one cable: its merged route when the backend
 * merged it, otherwise one feature per trench segment that has a geometry.
 * @param cableId - UUID of the cable.
 * @param infra - The cable's infrastructure.
 * @returns The cable's line features.
 */
function cableLineFeatures(cableId: string, infra: CableInfrastructure): GeoJSONFeature[] {
	const shared = cableProperties(cableId, infra);

	if (infra.merged_geometry) {
		const properties = {
			feature_type: 'cable',
			...shared,
			total_length: infra.total_length || null,
			trench_count: infra.trenches?.length || 0,
			geometry_mode: 'merged'
		};
		return [{ type: 'Feature', properties, geometry: infra.merged_geometry }];
	}

	const features: GeoJSONFeature[] = [];
	for (const trench of infra.trenches ?? []) {
		if (!trench.geometry) continue;
		const properties = {
			feature_type: 'trench',
			cable_id: cableId,
			trench_id: trench.id,
			id_trench: trench.id_trench,
			construction_type: trench.construction_type,
			surface: trench.surface,
			length: trench.length,
			...shared,
			geometry_mode: 'segments'
		};
		features.push({ type: 'Feature', properties, geometry: trench.geometry });
	}
	return features;
}

/**
 * Builds the point features of a node and its address, skipping entities that
 * were already collected.
 * @param endpointNode - The node, if the tree position has one.
 * @param seenIds - Ids of the entities collected so far; extended in place.
 * @returns Zero to two point features.
 */
function nodePointFeatures(
	endpointNode: EndpointNode | undefined,
	seenIds: Set<string>
): GeoJSONFeature[] {
	if (!endpointNode?.geometry || seenIds.has(endpointNode.id)) return [];
	seenIds.add(endpointNode.id);

	const features: GeoJSONFeature[] = [
		{
			type: 'Feature',
			properties: { feature_type: 'node', id: endpointNode.id, name: endpointNode.name },
			geometry: endpointNode.geometry
		}
	];

	const address = endpointNode.address;
	if (!address?.geometry || seenIds.has(address.id)) return features;
	seenIds.add(address.id);

	const properties = {
		feature_type: 'address',
		id: address.id,
		street: address.street,
		housenumber: address.housenumber,
		suffix: address.suffix || '',
		zip_code: address.zip_code,
		city: address.city
	};
	features.push({ type: 'Feature', properties, geometry: address.geometry });
	return features;
}

/**
 * Collects the node and address points of a trace tree, depth first.
 * @param treeNode - The tree position to start from.
 * @param seenIds - Ids of the entities collected so far; extended in place.
 * @returns The point features below and including `treeNode`.
 */
function treePointFeatures(
	treeNode: TraceTreeNode | undefined,
	seenIds: Set<string>
): GeoJSONFeature[] {
	if (!treeNode) return [];
	return [
		...nodePointFeatures(treeNode.node, seenIds),
		...nodePointFeatures(treeNode.cable_endpoints?.start_node, seenIds),
		...nodePointFeatures(treeNode.cable_endpoints?.end_node, seenIds),
		...(treeNode.children ?? []).flatMap((child) => treePointFeatures(child, seenIds))
	];
}

/**
 * Builds a GeoJSON FeatureCollection from trace result geometries.
 * Includes cable/trench LineStrings and node/address Point features.
 * @param traceResult - The trace result containing cable_infrastructure and trace tree(s)
 * @param srid - The EPSG code for the coordinate reference system (e.g. 25832)
 * @returns GeoJSON FeatureCollection in the specified SRID
 */
export function buildGeoJSON(traceResult: TraceResult, srid: number): GeoJSONFeatureCollection {
	const lines = Object.entries(traceResult.cable_infrastructure || {}).flatMap(([cableId, infra]) =>
		cableLineFeatures(cableId, infra)
	);

	const seenIds = new Set<string>();
	const trees = traceResult.trace_trees || (traceResult.trace_tree ? [traceResult.trace_tree] : []);
	const points = trees.flatMap((tree) => treePointFeatures(tree, seenIds));

	return {
		type: 'FeatureCollection',
		name: 'fiber_trace_infrastructure',
		crs: {
			type: 'name',
			properties: { name: `urn:ogc:def:crs:EPSG::${srid}` }
		},
		features: [...lines, ...points]
	};
}

/**
 * Checks whether the trace result contains any geometry data (trench or point).
 * @param traceResult - The trace result
 * @returns True if at least one geometry exists
 */
export function hasGeometries(traceResult: TraceResult | null | undefined): boolean {
	if (!traceResult) return false;

	if (traceResult.cable_infrastructure) {
		for (const infra of Object.values(traceResult.cable_infrastructure)) {
			if (infra.merged_geometry) return true;
			if (infra.trenches?.some((t) => t.geometry)) return true;
		}
	}

	const trees = traceResult.trace_trees || (traceResult.trace_tree ? [traceResult.trace_tree] : []);

	function hasPointGeometry(treeNode: TraceTreeNode | undefined): boolean {
		if (!treeNode) return false;
		if (treeNode.node?.geometry) return true;
		if (treeNode.node?.address?.geometry) return true;
		const ep = treeNode.cable_endpoints;
		if (ep?.start_node?.geometry || ep?.end_node?.geometry) return true;
		return (treeNode.children || []).some(hasPointGeometry);
	}

	return trees.some(hasPointGeometry);
}

/**
 * Triggers a browser download of the trace infrastructure as a GeoJSON file.
 * @param result - The trace result data
 * @param filenamePrefix - Prefix for the download filename (e.g. 'fiber-trace' or 'signal-analysis')
 * @param entryId - Entry UUID used in the filename
 * @param srid - The EPSG code for the coordinate reference system (e.g. 25832)
 */
export function downloadGeoJSON(
	result: TraceResult,
	filenamePrefix: string,
	entryId: string,
	srid: number
): void {
	const geojson = buildGeoJSON(result, srid);
	const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	const entryIdShort = entryId?.slice(0, 8) || 'unknown';
	a.download = `${filenamePrefix}-${entryIdShort}.geojson`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
