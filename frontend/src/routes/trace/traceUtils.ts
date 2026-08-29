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
	color_hex?: string;
	status?: string;
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
	cable_name?: string;
	conduit?: ConduitInfo;
	microduct?: MicroductInfo;
	merged_geometry?: GeoJSONGeometry;
	trenches?: TrenchSegment[];
	total_length?: number;
}

export interface AddressInfo {
	id: string;
	street: string;
	housenumber: string;
	suffix?: string;
	zip_code: string;
	city: string;
	geometry?: GeoJSONGeometry;
	id_address?: string;
	district?: string;
	status_development?: string;
	project?: string;
	flag?: string;
}

export interface EndpointNode {
	id: string;
	name: string;
	type?: string;
	geometry?: GeoJSONGeometry;
	address?: AddressInfo;
}

interface CableEndpoints {
	start_node?: EndpointNode;
	end_node?: EndpointNode;
}

/** A residential unit attached to a trace-tree node. */
export interface ResidentialUnitInfo {
	id?: string;
	uuid?: string;
	id_residential_unit?: string;
	geometry?: GeoJSONGeometry;
	type?: string;
	floor?: number | string;
	side?: string;
	building_section?: string;
	resident_name?: string;
	status?: string;
	address?: AddressInfo;
}

/** A fiber strand as rendered in the fiber-paths table. */
export interface FiberInfo {
	id?: string;
	cable_id?: string;
	cable_name?: string;
	cable_type?: string;
	bundle_number?: number | null;
	bundle_color?: string;
	bundle_color_hex?: string;
	fiber_color?: string;
	fiber_color_hex?: string;
	fiber_number_absolute?: number;
	fiber_number_in_bundle?: number;
	layer?: string;
	status?: string;
}

/** A component a splice sits in (container/slot metadata). */
export interface SpliceComponent {
	type?: string;
	slot_start?: number | null;
	slot_end?: number | null;
	slot_side?: string;
	in_or_out?: string;
}

/** A container step in a splice's container path. */
export interface ContainerPathEntry {
	type?: string;
	name?: string;
}

/** A fiber splice as rendered in the fiber-paths table. */
export interface SpliceInfo {
	port_number?: number | string;
	component?: SpliceComponent;
	container_path?: ContainerPathEntry[];
}

/** A splice at a cable endpoint (carries its own id and node). */
export interface EndpointSplice extends SpliceInfo {
	id?: string;
	node?: EndpointNode;
}

/**
 * A node in the fiber-paths tree (richer than the geometry-only
 * {@link TraceTreeNode} used by the map). Every field is optional — a node
 * carries only what's relevant to its position in the trace.
 */
export interface FiberPathNode {
	id?: string;
	name?: string;
	type?: string;
	signal_state?: string | null;
	node?: EndpointNode;
	address?: AddressInfo;
	fiber?: FiberInfo;
	splice?: SpliceInfo;
	endpoint_splices?: EndpointSplice[];
	cable_endpoints?: {
		cable_name?: string;
		start_node?: EndpointNode;
		end_node?: EndpointNode;
	};
	residential_units?: ResidentialUnitInfo[];
	children?: FiberPathNode[];
}

/**
 * A fiber-path node guaranteed to carry a fiber — the shape the recursive
 * `traceNode` renderers walk (geometry-only trees never reach them).
 */
export type FiberWaypoint = FiberPathNode & { fiber: FiberInfo };

/** A signal break point along a fiber path. */
export interface BreakPoint {
	cable_id?: string;
	cable_name?: string;
	fiber_id?: string;
	fiber_number_absolute?: number;
	status?: string;
	at_node?: EndpointNode;
}

/** A selectable signal source (cable start/end). */
export interface SignalSource {
	id: string;
	name: string;
	direction: string;
	is_default: boolean;
}

/** Signal-propagation analysis over a fiber trace. */
export interface SignalAnalysisData {
	total_breaks?: number;
	break_points?: BreakPoint[];
	available_sources?: SignalSource[];
	source_node?: EndpointNode;
}

/** Counts of lit/dark entities affected by a signal analysis. */
export interface AffectedSummary {
	lit_fibers?: number;
	dark_fibers?: number;
	lit_nodes?: number;
	dark_nodes?: number;
	affected_addresses?: number;
	affected_residential_units?: number;
}

/** A trace result carrying signal-analysis data. */
export interface SignalAnalysisResult extends TraceResult {
	signal_analysis?: SignalAnalysisData;
	affected_summary?: AffectedSummary;
}

/** Aggregate counts shown in the trace results summary. */
export interface TraceStatistics {
	total_fibers?: number;
	total_nodes?: number;
	total_splices?: number;
	total_cables?: number;
	total_trenches?: number;
	total_addresses?: number;
	total_residential_units?: number;
	has_branches?: boolean;
}

export interface TraceTreeNode {
	node?: EndpointNode;
	address?: AddressInfo;
	signal_state?: string | null;
	cable_endpoints?: CableEndpoints;
	residential_units?: ResidentialUnitInfo[];
	children?: TraceTreeNode[];
}

/** The entry point (first entity) of a trace, used to place a marker. */
export interface TraceEntryPoint {
	id?: string;
	name?: string;
	type?: string;
	floor?: number | string | null;
	geometry?: GeoJSONGeometry;
}

export interface TraceResult {
	cable_infrastructure?: Record<string, CableInfrastructure>;
	trace_trees?: FiberPathNode[] | null;
	trace_tree?: FiberPathNode | null;
	entry_point?: TraceEntryPoint;
	statistics?: TraceStatistics;
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
