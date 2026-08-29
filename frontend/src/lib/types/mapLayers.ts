/**
 * Client-safe shapes for the map layer-visibility tree and search-panel option
 * lists. These mirror the option payloads produced by `$lib/server/attributes`
 * (which can't be imported into client code — it pulls in server-only env), so
 * the map UI and the pages that feed it share one definition.
 */

/** A node-type option consumed by the map layer tree. */
export interface NodeType {
	id: number;
	node_type: string;
}

/** A trench surface option. */
export interface Surface {
	id: number;
	surface: string;
}

/** A trench construction-type option. */
export interface ConstructionType {
	id: number;
	construction_type: string;
}

/** An area-type option consumed by the map layer tree. */
export interface AreaType {
	id: number;
	area_type: string;
}
