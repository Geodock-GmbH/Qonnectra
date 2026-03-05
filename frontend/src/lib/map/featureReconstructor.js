// frontend/src/lib/map/featureReconstructor.js
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';

/**
 * Reconstruct OpenLayers Features from serialized worker data
 * @param {Array<Object>} serializedFeatures - Features serialized from worker
 * @returns {Feature[]}
 */
export function reconstructFeatures(serializedFeatures) {
	return serializedFeatures.map((data) => {
		const feature = new Feature();

		if (data.id !== undefined) {
			feature.setId(data.id);
		}

		// Set properties (excluding geometry)
		const { geometry, ...properties } = data.properties || {};
		feature.setProperties(properties);

		// Reconstruct geometry if present
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
 * @param {string} layout - Coordinate layout (XY, XYZ, etc.)
 * @param {number[]} [ends] - Ring/part end indices for polygons/multi-geometries
 * @returns {import('ol/geom/Geometry').default|null}
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
 * Get coordinate stride from layout
 * @param {string} layout
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
	// Simplified: treat as single polygon with multiple rings
	// Full implementation would need endss (array of arrays)
	return [unflattenPolygonCoordinates(flat, stride, ends)];
}
