export interface NodeType {
	/** Database id */
	id: number;
	/** Node type name (the identifier used for styling) */
	node_type: string;
	/** Optional physical dimension */
	dimension?: string | null;
	/** Optional grouping key */
	group?: string | null;
	/** Optional owning company */
	company?: string | null;
}

export interface Surface {
	/** Database id */
	id: number;
	/** Surface name (the identifier used for styling) */
	surface: string;
	/** Optional sealing classification */
	sealing?: string | null;
}

export interface ConstructionType {
	/** Database id */
	id: number;
	/** Construction type name (the identifier used for styling) */
	construction_type: string;
}

export interface AreaType {
	/** Database id */
	id: number;
	/** Area type name (the identifier used for styling) */
	area_type: string;
}
