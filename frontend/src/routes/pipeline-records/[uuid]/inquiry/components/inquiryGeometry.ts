import type { InquiryArea, PolygonGeometry } from '$lib/remote/pipeline-records/inquiry-area-data';
import type OlFeature from 'ol/Feature';
import type { ProjectionLike } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON.js';
import Polygon from 'ol/geom/Polygon.js';

/** A GeoJSON polygon feature as `InquiryDrawManager.renderPolygons` reads it. */
export type InquiryAreaFeature = {
	type: 'Feature';
	properties: { uuid: string; name: string | null };
	geometry: Record<string, unknown>;
};

/**
 * Turns saved inquiry areas into GeoJSON features for the polygon layer,
 * skipping areas without a geometry.
 * @param areas - The record's inquiry areas.
 */
export function toAreaFeatures(areas: InquiryArea[]): InquiryAreaFeature[] {
	return areas.flatMap((area) =>
		area.geometry
			? [
					{
						type: 'Feature' as const,
						properties: { uuid: area.uuid, name: area.name },
						geometry: { ...area.geometry }
					}
				]
			: []
	);
}

/**
 * Writes a drawn or modified map feature as an EPSG:4326 polygon, the
 * projection the backend accepts for writes.
 * @param feature - The map feature.
 * @param featureProjection - The map view's projection.
 * @returns The polygon, or `null` when the feature holds no polygon.
 */
export function toWgs84Polygon(
	feature: OlFeature,
	featureProjection: ProjectionLike
): PolygonGeometry | null {
	const geometry = feature.getGeometry();
	if (!(geometry instanceof Polygon)) return null;

	const written = new GeoJSON().writeGeometryObject(geometry, {
		dataProjection: 'EPSG:4326',
		featureProjection
	});
	return written.type === 'Polygon' ? { type: 'Polygon', coordinates: written.coordinates } : null;
}
