import type { PipelineInquiryArea } from '$lib/types';

/** A GeoJSON polygon geometry. */
export interface PolygonGeometry {
	type: 'Polygon';
	coordinates: number[][][];
}

/** A pipeline inquiry area flattened from its GeoJSON feature envelope. */
export interface InquiryArea {
	uuid: string;
	name: string | null;
	/** In the storage projection, as the backend serves it. */
	geometry: PolygonGeometry | null;
}

/**
 * Flattens a GeoJSON inquiry-area feature, taking the feature id as `uuid`.
 * @param feature - The raw feature from the backend.
 */
export function mapInquiryArea(feature: PipelineInquiryArea): InquiryArea {
	const geometry = feature.geometry;
	return {
		uuid: feature.id ?? '',
		name: feature.properties?.name ?? null,
		geometry:
			geometry?.type === 'Polygon' && geometry.coordinates
				? { type: 'Polygon', coordinates: geometry.coordinates }
				: null
	};
}

/**
 * Maps the `pipeline-inquiry-areas/` feature collection to inquiry areas.
 * @param payload - The backend feature collection.
 */
export function mapInquiryAreas(payload: { features?: PipelineInquiryArea[] }): InquiryArea[] {
	return (payload.features ?? []).map(mapInquiryArea);
}

/**
 * Builds the POST body for a new, unnamed inquiry area.
 * @param recordUuid - Pipeline record the area belongs to.
 * @param geometry - The drawn polygon in EPSG:4326; the backend transforms it.
 */
export function buildAreaCreateBody(
	recordUuid: string,
	geometry: PolygonGeometry
): Record<string, unknown> {
	return { pipeline_record: recordUuid, name: null, geom: geometry };
}

/**
 * Builds the PATCH body that replaces an inquiry area's geometry.
 * @param geometry - The modified polygon in EPSG:4326; the backend transforms it.
 */
export function buildAreaGeometryPatch(geometry: PolygonGeometry): Record<string, unknown> {
	return { type: 'Feature', geometry, properties: {} };
}

/**
 * Builds the PATCH body that renames an inquiry area.
 * @param name - The new name.
 */
export function buildAreaRenamePatch(name: string): Record<string, unknown> {
	return { type: 'Feature', properties: { name } };
}
