import type { SerializedFeature } from './featureReconstructor';
import type { Extent } from 'ol/extent';
import MVT from 'ol/format/MVT.js';

export interface ParseRequest {
	/** Unique request identifier */
	requestId: string;
	/** MVT tile data */
	data: ArrayBuffer;
	/** Tile extent */
	extent: Extent;
	/** Target projection code */
	projection: string;
}

export interface ParseSuccessResponse {
	/** Request identifier */
	requestId: string;
	/** Success flag */
	success: true;
	/** Parsed features */
	features: SerializedFeature[];
}

export interface ParseErrorResponse {
	/** Request identifier */
	requestId: string;
	/** Success flag */
	success: false;
	/** Error message */
	error: string;
}

const format = new MVT();

/**
 * Handles incoming parse requests from the main thread.
 * Web Workers cannot transfer OpenLayers Feature objects directly,
 * so geometry and properties are extracted as plain objects.
 */
self.onmessage = function (e: MessageEvent<ParseRequest>): void {
	const { requestId, data, extent, projection } = e.data;

	try {
		const features = format.readFeatures(data, {
			extent: extent,
			featureProjection: projection
		});

		const serializedFeatures: SerializedFeature[] = features.map((feature) => ({
			id: feature.getId(),
			properties: feature.getProperties(),
			// @ts-ignore - RenderFeature lacks getGeometryName but it exists at runtime
			geometryName: feature.getGeometryName(),
			flatCoordinates: feature.getGeometry()?.getFlatCoordinates(),
			// @ts-ignore - RenderFeature lacks getLayout but it exists at runtime
			geometryLayout: feature.getGeometry()?.getLayout(),
			geometryType: feature.getGeometry()?.getType()
		}));

		const response: ParseSuccessResponse = {
			requestId,
			success: true,
			features: serializedFeatures
		};
		self.postMessage(response);
	} catch (error: unknown) {
		const response: ParseErrorResponse = {
			requestId,
			success: false,
			error: error instanceof Error ? error.message : String(error)
		};
		self.postMessage(response);
	}
};
