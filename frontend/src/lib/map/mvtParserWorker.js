// frontend/src/lib/map/mvtParserWorker.js
import MVT from 'ol/format/MVT.js';

const format = new MVT();

/**
 * @param {import('ol/render/Feature').default} feature
 * @returns {import('ol/geom/Geometry').GeometryLayout}
 */
function getLayoutFromFeature(feature) {
	const type = feature.getType();
	const flatCoords = feature.getFlatCoordinates();
	const ends = feature.getEnds();

	if (type === 'Point') {
		return flatCoords.length === 3 ? 'XYZ' : flatCoords.length === 4 ? 'XYZM' : 'XY';
	}

	if (ends && ends.length > 0) {
		const stride = ends[0] / (type === 'LineString' ? ends[0] / 2 : 1);
		if (stride === 3) return 'XYZ';
		if (stride === 4) return 'XYZM';
	}

	return 'XY';
}

/**
 * Parse MVT data and return serialized features.
 * Web Workers can't transfer OpenLayers Feature objects directly,
 * so we extract the geometry and properties as plain objects.
 */
self.onmessage = function (e) {
	const { requestId, data, extent, projection } = e.data;

	try {
		const features = format.readFeatures(data, {
			extent: extent,
			featureProjection: projection
		});

		const serializedFeatures = features.map((feature) => ({
			id: feature.getId(),
			properties: feature.getProperties(),
			geometryName: 'geometry',
			flatCoordinates: feature.getFlatCoordinates(),
			geometryLayout: getLayoutFromFeature(feature),
			geometryType: feature.getType()
		}));

		self.postMessage({
			requestId,
			success: true,
			features: serializedFeatures
		});
	} catch (error) {
		self.postMessage({
			requestId,
			success: false,
			error: /** @type {Error} */ (error).message
		});
	}
};
