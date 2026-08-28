import type { GeometryLayout } from 'ol/geom/Geometry';
import type { Type as RenderFeatureType } from 'ol/render/Feature';
import RenderFeature from 'ol/render/Feature.js';

export interface SerializedFeature {
	/** Feature ID */
	id: string | number | undefined;
	/** Feature properties including geometry */
	properties?: Record<string, unknown>;
	/** Flat coordinate array */
	flatCoordinates?: number[];
	/** Coordinate layout (XY, XYZ, etc.) */
	geometryLayout?: GeometryLayout;
	/** Geometry type name (Point, LineString, etc.) */
	geometryType?: string;
	/** Ring/part end indices for multi-part geometries */
	ends?: number[];
}

/**
 * Reconstructs RenderFeature objects from serialized worker data.
 *
 * The tile pipeline must yield RenderFeatures (what ol/format/MVT produces),
 * not ol/Feature: vector tile consumers rely on the RenderFeature geometry API
 * (getExtent/getFlatCoordinates/getType on the feature itself), e.g. the
 * inquiry highlight styles. Features without geometry cannot be rendered and
 * are dropped.
 */
export function reconstructFeatures(serializedFeatures: SerializedFeature[]): RenderFeature[] {
	return serializedFeatures
		.filter((data) => data.geometryType && data.flatCoordinates)
		.map((data) => {
			const { geometry: _geometry, ...properties } = data.properties || {};
			return new RenderFeature(
				data.geometryType as RenderFeatureType,
				data.flatCoordinates as number[],
				data.ends ?? [],
				getStride(data.geometryLayout),
				properties,
				data.id
			);
		});
}

/**
 * Determines coordinate stride (values per coordinate) from geometry layout.
 * @returns Number of values per coordinate (2 for XY, 3 for XYZ/XYM, 4 for XYZM)
 */
function getStride(layout: GeometryLayout | undefined): number {
	switch (layout) {
		case 'XYZ':
		case 'XYM':
			return 3;
		case 'XYZM':
			return 4;
		default:
			return 2;
	}
}
