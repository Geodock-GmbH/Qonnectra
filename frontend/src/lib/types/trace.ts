/**
 * Shared types for the trace UI (search page + result/path tables).
 *
 * Trace search returns polymorphic rows (address / node / cable / residential
 * unit); each result carries only the fields relevant to its entity type, so
 * every field is optional here and the format helpers read the ones they need.
 */

/** A single row from the trace search endpoint. */
export interface TraceSearchResult {
	uuid?: string;
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
	[key: string]: unknown;
}

/** A cable selected for fiber tracing. */
export interface TraceCable {
	uuid?: string;
	name?: string;
	cable_type?: string | { cable_type?: string } | null;
	[key: string]: unknown;
}

/** A fiber row shown for a selected cable. */
export interface TraceFiber {
	uuid: string;
	bundle_number: number;
	bundle_color?: string;
	fiber_color?: string;
	fiber_number_in_bundle?: number;
	[key: string]: unknown;
}
