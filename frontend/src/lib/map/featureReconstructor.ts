import type Geometry from 'ol/geom/Geometry';
import type { GeometryLayout } from 'ol/geom/Geometry';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';

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

/** Reconstructs OpenLayers Feature objects from serialized worker data. */
export function reconstructFeatures(serializedFeatures: SerializedFeature[]): Feature[] {
	return serializedFeatures.map((data) => {
		const feature = new Feature();

		if (data.id !== undefined) {
			feature.setId(data.id);
		}

		const { geometry, ...properties } = data.properties || {};
		feature.setProperties(properties);

		if (data.flatCoordinates && data.geometryType) {
			const geom = createGeometry(
				data.geometryType,
				data.flatCoordinates,
				data.geometryLayout,
				data.ends
			);
			if (geom) {
				feature.setGeometry(geom);
			}
		}

		return feature;
	});
}

/** Creates an OpenLayers geometry from flat coordinate data. */
function createGeometry(
	type: string,
	flatCoordinates: number[],
	layout: GeometryLayout | undefined,
	ends: number[] | undefined
): Geometry | null {
	const stride = getStride(layout);

	switch (type) {
		case 'Point':
			return new Point(flatCoordinates, layout);

		case 'LineString':
			return new LineString(unflattenCoordinates(flatCoordinates, stride), layout);

		case 'Polygon': {
			const coords = unflattenPolygonCoordinates(flatCoordinates, stride, ends);
			return new Polygon(coords, layout);
		}

		case 'MultiPoint':
			return new MultiPoint(unflattenCoordinates(flatCoordinates, stride), layout);

		case 'MultiLineString': {
			const lineCoords = unflattenMultiLineCoordinates(flatCoordinates, stride, ends);
			return new MultiLineString(lineCoords, layout);
		}

		case 'MultiPolygon': {
			const polyCoords = unflattenMultiPolygonCoordinates(flatCoordinates, stride, ends);
			return new MultiPolygon(polyCoords, layout);
		}

		default:
			console.warn(`Unsupported geometry type: ${type}`);
			return null;
	}
}

/**
 * Determines coordinate stride (values per coordinate) from geometry layout.
 * @returns Number of values per coordinate (2 for XY, 3 for XYZ/XYM, 4 for XYZM)
 */
function getStride(layout: GeometryLayout | undefined): number {
	switch (layout) {
		case 'XY':
			return 2;
		case 'XYZ':
			return 3;
		case 'XYM':
			return 3;
		case 'XYZM':
			return 4;
		default:
			return 2;
	}
}

/** Converts a flat coordinate array to nested coordinate pairs/tuples. */
function unflattenCoordinates(flat: number[], stride: number): number[][] {
	const coords: number[][] = [];
	for (let i = 0; i < flat.length; i += stride) {
		coords.push(flat.slice(i, i + stride));
	}
	return coords;
}

/** Converts flat polygon coordinates to ring arrays using end indices. */
function unflattenPolygonCoordinates(
	flat: number[],
	stride: number,
	ends: number[] | undefined
): number[][][] {
	if (!ends || ends.length === 0) {
		return [unflattenCoordinates(flat, stride)];
	}

	const rings: number[][][] = [];
	let start = 0;
	for (const end of ends) {
		rings.push(unflattenCoordinates(flat.slice(start, end), stride));
		start = end;
	}
	return rings;
}

/** Converts flat MultiLineString coordinates to line arrays using end indices. */
function unflattenMultiLineCoordinates(
	flat: number[],
	stride: number,
	ends: number[] | undefined
): number[][][] {
	if (!ends || ends.length === 0) {
		return [unflattenCoordinates(flat, stride)];
	}

	const lines: number[][][] = [];
	let start = 0;
	for (const end of ends) {
		lines.push(unflattenCoordinates(flat.slice(start, end), stride));
		start = end;
	}
	return lines;
}

/**
 * Converts flat MultiPolygon coordinates to polygon arrays.
 * Note: This is a simplified implementation that treats the data as a single polygon
 * with multiple rings. Full MultiPolygon support would require endss (array of arrays).
 */
function unflattenMultiPolygonCoordinates(
	flat: number[],
	stride: number,
	ends: number[] | undefined
): number[][][][] {
	return [unflattenPolygonCoordinates(flat, stride, ends)];
}
