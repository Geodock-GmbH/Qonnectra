// frontend/src/lib/map/mvtParserWorker.js
import MVT from 'ol/format/MVT.js';

/**
 * @typedef {Object} SerializedFeature
 * @property {string | number | undefined} id - Feature ID
 * @property {Record<string, unknown>} properties - Feature properties
 * @property {string} geometryName - Name of the geometry property
 * @property {number[] | undefined} flatCoordinates - Flat coordinate array
 * @property {import('ol/geom/Geometry').GeometryLayout | undefined} geometryLayout - Coordinate layout (XY, XYZ, etc.)
 * @property {import('ol/geom/Geometry').Type | undefined} geometryType - Geometry type name
 */

/**
 * @typedef {Object} ParseRequest
 * @property {string} requestId - Unique request identifier
 * @property {ArrayBuffer} data - MVT tile data
 * @property {import('ol/extent').Extent} extent - Tile extent
 * @property {string} projection - Target projection code
 */

/**
 * @typedef {Object} ParseSuccessResponse
 * @property {string} requestId - Request identifier
 * @property {true} success - Success flag
 * @property {SerializedFeature[]} features - Parsed features
 */

/**
 * @typedef {Object} ParseErrorResponse
 * @property {string} requestId - Request identifier
 * @property {false} success - Success flag
 * @property {string} error - Error message
 */

const format = new MVT();

/**
 * Handles incoming parse requests from the main thread.
 * Web Workers cannot transfer OpenLayers Feature objects directly,
 * so geometry and properties are extracted as plain objects.
 * @param {MessageEvent<ParseRequest>} e - Message event containing parse request
 */
self.onmessage = function (e) {
	const { requestId, data, extent, projection } = e.data;

	try {
		const features = format.readFeatures(data, {
			extent: extent,
			featureProjection: projection
		});

		/** @type {SerializedFeature[]} */
		const serializedFeatures = features.map((feature) => ({
			id: feature.getId(),
			properties: feature.getProperties(),
			geometryName: feature.getGeometryName(),
			flatCoordinates: feature.getGeometry()?.getFlatCoordinates(),
			geometryLayout: feature.getGeometry()?.getLayout(),
			geometryType: feature.getGeometry()?.getType()
		}));

		/** @type {ParseSuccessResponse} */
		const response = {
			requestId,
			success: true,
			features: serializedFeatures
		};
		self.postMessage(response);
	} catch (/** @type {unknown} */ error) {
		/** @type {ParseErrorResponse} */
		const response = {
			requestId,
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
		self.postMessage(response);
	}
};
