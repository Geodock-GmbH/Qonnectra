import type { AreaType, ConstructionType, NodeType, Surface } from '$lib/server/attributes';

/** Layers whose extent the backend can compute. */
export const EXTENT_LAYER_TYPES = ['trench', 'address', 'node', 'area'] as const;

export type ExtentLayerType = (typeof EXTENT_LAYER_TYPES)[number];

/** Bounding box of a layer within a project; `null` when the layer is empty. */
export interface LayerExtent {
	extent: [number, number, number, number] | null;
	layer: string;
}

/** Attribute lists the map needs to style and filter its layers. */
export interface LayerStyleAttributes {
	nodeTypes: NodeType[];
	surfaces: Surface[];
	constructionTypes: ConstructionType[];
	areaTypes: AreaType[];
}

/**
 * Narrows a layer type coming from the layer tree to one the backend can
 * compute an extent for.
 * @param layerType - Layer type of the clicked tree entry.
 * @returns Whether an extent can be requested for it.
 */
export function isExtentLayerType(layerType: string | null): layerType is ExtentLayerType {
	return EXTENT_LAYER_TYPES.some((type) => type === layerType);
}
