import type { SerializedFeature } from './featureReconstructor';
import type { Extent } from 'ol/extent';
import type { GeometryLayout } from 'ol/geom/Geometry';
import MVT from 'ol/format/MVT.js';
import RenderFeature from 'ol/render/Feature.js';

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
 * Maps a coordinate stride to its OpenLayers geometry layout.
 * MVT tiles are always 2D (stride 2), but this stays general in case a
 * future tile source carries elevation or measure values.
 */
function layoutForStride(stride: number): GeometryLayout {
	switch (stride) {
		case 3:
			return 'XYZ';
		case 4:
			return 'XYZM';
		default:
			return 'XY';
	}
}

/**
 * Serializes a single MVT RenderFeature into a transferable plain object.
 *
 * new MVT() (no featureClass) yields RenderFeature, whose geometry API differs
 * from ol/geom: coordinates, stride and part boundaries come off the feature
 * itself, not a separate geometry object. Calling getGeometryName()/getLayout()
 * here (as this code once did) throws, because RenderFeature has neither.
 */
export function serializeFeature(feature: RenderFeature): SerializedFeature {
	return {
		id: feature.getId(),
		properties: feature.getProperties(),
		flatCoordinates: feature.getFlatCoordinates(),
		geometryLayout: layoutForStride(feature.getStride()),
		geometryType: feature.getType(),
		ends: feature.getEnds() ?? undefined
	};
}

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
		}) as RenderFeature[];

		const serializedFeatures: SerializedFeature[] = features.map(serializeFeature);

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
