import { goto } from '$app/navigation';

export interface GeoJSONGeometry {
	type: string;
	coordinates: unknown;
}

interface ConduitInfo {
	name?: string;
	type?: string;
}

interface MicroductInfo {
	number?: number;
	color?: string;
}

interface TrenchSegment {
	id: string;
	id_trench: string;
	construction_type: string;
	surface: string;
	length: number;
	geometry?: GeoJSONGeometry;
}

export interface CableInfrastructure {
	conduit?: ConduitInfo;
	microduct?: MicroductInfo;
	merged_geometry?: GeoJSONGeometry;
	trenches?: TrenchSegment[];
	total_length?: number;
}

interface AddressInfo {
	id: string;
	street: string;
	housenumber: string;
	suffix?: string;
	zip_code: string;
	city: string;
	geometry?: GeoJSONGeometry;
}

interface EndpointNode {
	id: string;
	name: string;
	geometry?: GeoJSONGeometry;
	address?: AddressInfo;
}

interface CableEndpoints {
	start_node?: EndpointNode;
	end_node?: EndpointNode;
}

export interface TraceTreeNode {
	node?: EndpointNode;
	cable_endpoints?: CableEndpoints;
	children?: TraceTreeNode[];
}

export interface TraceResult {
	cable_infrastructure?: Record<string, CableInfrastructure>;
	trace_trees?: TraceTreeNode[];
	trace_tree?: TraceTreeNode;
}

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

type EntityType = 'fiber' | 'cable' | 'node' | 'address' | 'residential_unit';

/**
 * Navigates to the trace page for a given entity.
 * @param type - Entity type (e.g. 'fiber', 'cable', 'node', 'address', 'residential_unit')
 * @param id - Entity UUID
 */
export function traceFrom(type: EntityType, id: string): void {
	const typeSlug = type === 'residential_unit' ? 'residential-unit' : type;
	goto(`/trace/${typeSlug}/${id}`);
}

/**
 * Builds a GeoJSON FeatureCollection from trace result geometries.
 * Includes cable/trench LineStrings and node/address Point features.
 * @param traceResult - The trace result containing cable_infrastructure and trace tree(s)
 * @param srid - The EPSG code for the coordinate reference system (e.g. 25832)
 * @returns GeoJSON FeatureCollection in the specified SRID
 */
export function buildGeoJSON(traceResult: TraceResult, srid: number): GeoJSONFeatureCollection {
	const features: GeoJSONFeature[] = [];
	const cableInfra = traceResult.cable_infrastructure || {};

	for (const [cableId, infra] of Object.entries(cableInfra)) {
		if (infra.merged_geometry) {
			features.push({
				type: 'Feature',
				properties: {
					feature_type: 'cable',
					cable_id: cableId,
					conduit_name: infra.conduit?.name || null,
					conduit_type: infra.conduit?.type || null,
					microduct_number: infra.microduct?.number || null,
					microduct_color: infra.microduct?.color || null,
					total_length: infra.total_length || null,
					trench_count: infra.trenches?.length || 0,
					geometry_mode: 'merged'
				},
				geometry: infra.merged_geometry
			});
		} else if (infra.trenches) {
			for (const trench of infra.trenches) {
				if (trench.geometry) {
					features.push({
						type: 'Feature',
						properties: {
							feature_type: 'trench',
							cable_id: cableId,
							trench_id: trench.id,
							id_trench: trench.id_trench,
							construction_type: trench.construction_type,
							surface: trench.surface,
							length: trench.length,
							conduit_name: infra.conduit?.name || null,
							conduit_type: infra.conduit?.type || null,
							microduct_number: infra.microduct?.number || null,
							microduct_color: infra.microduct?.color || null,
							geometry_mode: 'segments'
						},
						geometry: trench.geometry
					});
				}
			}
		}
	}

	const seenIds = new Set<string>();
	const trees = traceResult.trace_trees || (traceResult.trace_tree ? [traceResult.trace_tree] : []);

	function addNodeFeature(endpointNode: EndpointNode | undefined): void {
		if (!endpointNode?.geometry || seenIds.has(endpointNode.id)) return;
		seenIds.add(endpointNode.id);
		features.push({
			type: 'Feature',
			properties: { feature_type: 'node', id: endpointNode.id, name: endpointNode.name },
			geometry: endpointNode.geometry
		});
		if (endpointNode.address?.geometry && !seenIds.has(endpointNode.address.id)) {
			seenIds.add(endpointNode.address.id);
			features.push({
				type: 'Feature',
				properties: {
					feature_type: 'address',
					id: endpointNode.address.id,
					street: endpointNode.address.street,
					housenumber: endpointNode.address.housenumber,
					suffix: endpointNode.address.suffix || '',
					zip_code: endpointNode.address.zip_code,
					city: endpointNode.address.city
				},
				geometry: endpointNode.address.geometry
			});
		}
	}

	function extractPointFeatures(treeNode: TraceTreeNode | undefined): void {
		if (!treeNode) return;
		addNodeFeature(treeNode.node);
		const endpoints = treeNode.cable_endpoints;
		if (endpoints) {
			addNodeFeature(endpoints.start_node);
			addNodeFeature(endpoints.end_node);
		}
		for (const child of treeNode.children || []) {
			extractPointFeatures(child);
		}
	}

	for (const tree of trees) {
		extractPointFeatures(tree);
	}

	return {
		type: 'FeatureCollection',
		name: 'fiber_trace_infrastructure',
		crs: {
			type: 'name',
			properties: { name: `urn:ogc:def:crs:EPSG::${srid}` }
		},
		features
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
