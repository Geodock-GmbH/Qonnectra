// frontend/src/lib/map/featureReconstructor.js
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';

/**
 * @typedef {Object} SerializedFeature
 * @property {string | number | undefined} id - Feature ID
 * @property {Record<string, unknown>} [properties] - Feature properties including geometry
 * @property {string} [geometryName] - Name of the geometry property
 * @property {number[]} [flatCoordinates] - Flat coordinate array
 * @property {import('ol/geom/Geometry').GeometryLayout} [geometryLayout] - Coordinate layout (XY, XYZ, etc.)
 * @property {string} [geometryType] - Geometry type name (Point, LineString, etc.)
 * @property {number[]} [ends] - Ring/part end indices for multi-part geometries
 */

/**
 * Reconstructs OpenLayers Feature objects from serialized worker data.
 * @param {SerializedFeature[]} serializedFeatures - Features serialized from MVT parser worker
 * @returns {Feature[]} Array of reconstructed OpenLayers features
 */
export function reconstructFeatures(serializedFeatures) {
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

/**
 * Creates an OpenLayers geometry from flat coordinate data.
 * @param {string} type - Geometry type (Point, LineString, Polygon, etc.)
 * @param {number[]} flatCoordinates - Flat coordinate array from serialized feature
 * @param {import('ol/geom/Geometry').GeometryLayout | undefined} layout - Coordinate layout (XY, XYZ, XYM, XYZM)
 * @param {number[] | undefined} ends - Ring/part end indices for multi-part geometries
 * @returns {import('ol/geom/Geometry').default | null} Reconstructed geometry or null if type unsupported
 */
function createGeometry(type, flatCoordinates, layout, ends) {
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
 * @param {import('ol/geom/Geometry').GeometryLayout | undefined} layout - Coordinate layout identifier
 * @returns {number} Number of values per coordinate (2 for XY, 3 for XYZ/XYM, 4 for XYZM)
 */
function getStride(layout) {
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

/**
 * Converts a flat coordinate array to nested coordinate pairs/tuples.
 * @param {number[]} flat - Flat coordinate array
 * @param {number} stride - Number of values per coordinate
 * @returns {number[][]} Array of coordinate arrays
 */
function unflattenCoordinates(flat, stride) {
	const coords = [];
	for (let i = 0; i < flat.length; i += stride) {
		coords.push(flat.slice(i, i + stride));
	}
	return coords;
}

/**
 * Converts flat polygon coordinates to ring arrays using end indices.
 * @param {number[]} flat - Flat coordinate array
 * @param {number} stride - Number of values per coordinate
 * @param {number[] | undefined} ends - Array of end indices for each ring
 * @returns {number[][][]} Array of rings, each containing coordinate arrays
 */
function unflattenPolygonCoordinates(flat, stride, ends) {
	if (!ends || ends.length === 0) {
		return [unflattenCoordinates(flat, stride)];
	}

	const rings = [];
	let start = 0;
	for (const end of ends) {
		rings.push(unflattenCoordinates(flat.slice(start, end), stride));
		start = end;
	}
	return rings;
}

/**
 * Converts flat MultiLineString coordinates to line arrays using end indices.
 * @param {number[]} flat - Flat coordinate array
 * @param {number} stride - Number of values per coordinate
 * @param {number[] | undefined} ends - Array of end indices for each line
 * @returns {number[][][]} Array of lines, each containing coordinate arrays
 */
function unflattenMultiLineCoordinates(flat, stride, ends) {
	if (!ends || ends.length === 0) {
		return [unflattenCoordinates(flat, stride)];
	}

	const lines = [];
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
 * @param {number[]} flat - Flat coordinate array
 * @param {number} stride - Number of values per coordinate
 * @param {number[] | undefined} ends - Array of end indices
 * @returns {number[][][][]} Array of polygons, each containing ring arrays
 */
function unflattenMultiPolygonCoordinates(flat, stride, ends) {
	return [unflattenPolygonCoordinates(flat, stride, ends)];
}
