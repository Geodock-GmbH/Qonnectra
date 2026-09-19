/**
 * Shapes for the map layer-visibility tree and search-panel option lists, shared
 * by the map UI, the pages that feed it, and the remote functions that fetch the
 * attribute lists. The single definition of these attribute options.
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
