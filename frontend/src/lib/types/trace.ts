/**
 * Shared types for the trace UI (search page + result/path tables) and the
 * trace payloads the backend returns.
 *
 * Trace search returns polymorphic rows (address / node / cable / residential
 * unit); each result carries only the fields relevant to its entity type, so
 * every field is optional here and the format helpers read the ones they need.
 */

/** A single row from the trace search endpoint. */
export interface TraceSearchResult {
	uuid: string;
	name?: string;
	// address
	street?: string;
	housenumber?: string | number;
	house_number_suffix?: string;
	zip_code?: string;
	city?: string;
	id_address?: string;
	// node
	node_type?: string | { node_type?: string } | null;
	// cable
	cable_type?: string | { cable_type?: string } | null;
	// residential unit
	id_residential_unit?: string;
	floor?: string | number | null;
	side?: string;
	address_street?: string | null;
	address_housenumber?: string | number | null;
	[key: string]: unknown;
}

/** A cable selected for fiber tracing. */
export interface TraceCable {
	uuid: string;
	name?: string;
	cable_type?: string | { cable_type?: string } | null;
	[key: string]: unknown;
}

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
