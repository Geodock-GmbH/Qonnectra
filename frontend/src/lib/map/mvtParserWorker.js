// frontend/src/lib/map/mvtParserWorker.js
import MVT from 'ol/format/MVT.js';

const format = new MVT();

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

		// Serialize features for transfer back to main thread
		const serializedFeatures = features.map((feature) => ({
			id: feature.getId(),
			properties: feature.getProperties(),
			geometryName: feature.getGeometryName(),
			flatCoordinates: feature.getGeometry()?.getFlatCoordinates(),
			geometryLayout: feature.getGeometry()?.getLayout(),
			geometryType: feature.getGeometry()?.getType()
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
			error: error.message
		});
	}
};
