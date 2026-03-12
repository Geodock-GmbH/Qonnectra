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
 * @property {string|number} [id]
 * @property {Record<string, unknown>} [properties]
 * @property {number[]} [flatCoordinates]
 * @property {string} [geometryType]
 * @property {import('ol/geom/Geometry').GeometryLayout} [geometryLayout]
 * @property {number[]} [ends]
 */

/**
 * Reconstruct OpenLayers Features from serialized worker data
 * @param {SerializedFeature[]} serializedFeatures - Features serialized from worker
 * @returns {Feature[]}
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
 * Create geometry from flat coordinates
 * @param {string} type - Geometry type
 * @param {number[]} flatCoordinates - Flat coordinate array
 * @param {import('ol/geom/Geometry').GeometryLayout | undefined} layout - Coordinate layout (XY, XYZ, etc.)
 * @param {number[]} [ends] - Ring/part end indices for polygons/multi-geometries
 * @returns {import('ol/geom/Geometry').default|null}
 */
function createGeometry(type, flatCoordinates, layout, ends) {
	const actualLayout = layout || 'XY';
	const stride = getStride(actualLayout);

	switch (type) {
		case 'Point':
			return new Point(flatCoordinates, actualLayout);

		case 'LineString':
			return new LineString(unflattenCoordinates(flatCoordinates, stride), actualLayout);

		case 'Polygon': {
			const coords = unflattenPolygonCoordinates(flatCoordinates, stride, ends);
			return new Polygon(coords, actualLayout);
		}

		case 'MultiPoint':
			return new MultiPoint(unflattenCoordinates(flatCoordinates, stride), actualLayout);

		case 'MultiLineString': {
			const lineCoords = unflattenMultiLineCoordinates(flatCoordinates, stride, ends);
			return new MultiLineString(lineCoords, actualLayout);
		}

		case 'MultiPolygon': {
			const polyCoords = unflattenMultiPolygonCoordinates(flatCoordinates, stride, ends);
			return new MultiPolygon(polyCoords, actualLayout);
		}

		default:
			console.warn(`Unsupported geometry type: ${type}`);
			return null;
	}
}

/**
 * Get coordinate stride from layout
 * @param {import('ol/geom/Geometry').GeometryLayout} layout
 * @returns {number}
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
 * Convert flat coordinates to coordinate array
 * @param {number[]} flat
 * @param {number} stride
 * @returns {number[][]}
 */
function unflattenCoordinates(flat, stride) {
	const coords = [];
	for (let i = 0; i < flat.length; i += stride) {
		coords.push(flat.slice(i, i + stride));
	}
	return coords;
}

/**
 * Convert flat polygon coordinates to rings
 * @param {number[]} flat
 * @param {number} stride
 * @param {number[]} [ends]
 * @returns {number[][][]}
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
 * Convert flat multi-linestring coordinates
 * @param {number[]} flat
 * @param {number} stride
 * @param {number[]} [ends]
 * @returns {number[][][]}
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
 * Convert flat multi-polygon coordinates (simplified)
 * @param {number[]} flat
 * @param {number} stride
 * @param {number[]} [ends]
 * @returns {number[][][][]}
 */
function unflattenMultiPolygonCoordinates(flat, stride, ends) {
	return [unflattenPolygonCoordinates(flat, stride, ends)];
}
