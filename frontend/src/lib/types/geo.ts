/**
 * Shared loose GeoJSON-ish types for map/geometry code that consumes untyped
 * API payloads. Prefer OpenLayers' own types where a concrete OL value exists;
 * these cover the raw JSON coming back from the backend.
 */

/** A GeoJSON point geometry (typically EPSG:3857). */
export type PointGeom = { coordinates?: number[] } | null;

/** A GeoJSON feature carrying a geometry. */
export type GeoJsonFeature = { geometry?: unknown; [key: string]: unknown };
