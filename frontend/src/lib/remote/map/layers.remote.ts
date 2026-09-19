import type { LayerExtent, LayerStyleAttributes } from './layer-data';
import type { AreaType, ConstructionType, NodeType, Surface } from '$lib/types/mapLayers';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { EXTENT_LAYER_TYPES } from './layer-data';

const LayerExtentSchema = v.object({
	layerType: v.picklist(EXTENT_LAYER_TYPES),
	projectId: v.pipe(v.string(), v.nonEmpty())
});

/**
 * Fetches one attribute list.
 * @param path - Backend path relative to `API_URL`.
 * @param headers - Django auth headers.
 * @returns The attribute rows.
 * @throws When the backend request fails.
 */
async function fetchAttributeList<T>(path: string, headers: Record<string, string>): Promise<T[]> {
	const response = await fetch(`${API_URL}${path}`, { headers });
	if (!response.ok) await failFromResponse(response, `Failed to fetch ${path}`);
	return (await response.json()) as T[];
}

/**
 * Fetch the bounding box of a layer within a project.
 * @param input.layerType - Layer to measure.
 * @param input.projectId - Project the layer belongs to.
 * @returns The layer extent in the storage projection.
 * @throws When the backend request fails.
 */
export const getLayerExtent = query(
	LayerExtentSchema,
	async ({ layerType, projectId }): Promise<LayerExtent> => {
		const response = await fetch(
			`${API_URL}layer-extent/?layer=${layerType}&project=${encodeURIComponent(projectId)}`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to fetch layer extent');

		return (await response.json()) as LayerExtent;
	}
);

/**
 * Fetch the attribute lists the map's layer tree styles its layers by.
 * @returns Node types, surfaces, construction types and area types.
 * @throws When a backend request fails.
 */
export const getLayerStyleAttributes = query(async (): Promise<LayerStyleAttributes> => {
	const headers = djangoHeaders();
	const [nodeTypes, surfaces, constructionTypes, areaTypes] = await Promise.all([
		fetchAttributeList<NodeType>('attributes_node_type/', headers),
		fetchAttributeList<Surface>('attributes_surface/', headers),
		fetchAttributeList<ConstructionType>('attributes_construction_type/', headers),
		fetchAttributeList<AreaType>('attributes_area_type/', headers)
	]);

	return { nodeTypes, surfaces, constructionTypes, areaTypes };
});
