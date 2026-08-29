/**
 * Search utilities for map features
 */

import type { Extent } from 'ol/extent';
import type Geometry from 'ol/geom/Geometry';
import type VectorLayer from 'ol/layer/Vector';
import type OlMap from 'ol/Map';
import type VectorSource from 'ol/source/Vector';
import type Style from 'ol/style/Style';

interface ZoomOptions {
	padding?: number[];
	duration?: number;
	maxZoom?: number;
	blinkCount?: number;
}

/** The payload the search panel emits on selection: a raw feature, or a conduit selection. */
export type SearchFeaturePayload =
	| Record<string, unknown>
	| { type: 'conduit'; uuid: string; trenches: unknown; trenchUuids: unknown };

/** Creates a highlight layer for temporarily highlighting features */
export async function createHighlightLayer(
	highlightStyle: Style
): Promise<VectorLayer<VectorSource>> {
	const [{ default: VectorLayer }, { default: VectorSource }] = await Promise.all([
		import('ol/layer/Vector'),
		import('ol/source/Vector')
	]);

	return new VectorLayer({
		source: new VectorSource(),
		style: highlightStyle,
		zIndex: 1000,
		properties: {
			isHighlightLayer: true
		}
	});
}

/** Parses geometry from GeoJSON feature and converts to OL geometry */
export async function parseFeatureGeometry(
	feature: Record<string, unknown>,
	fromProjection: string,
	toProjection: string | null = null
): Promise<Geometry | undefined> {
	const [{ default: GeoJSON }] = await Promise.all([import('ol/format/GeoJSON')]);

	const geoJsonFormat = new GeoJSON();

	const olFeature = geoJsonFormat.readFeature(feature, {
		dataProjection: fromProjection,
		featureProjection: toProjection || fromProjection
	});

	if (Array.isArray(olFeature)) {
		return olFeature[0]?.getGeometry();
	}

	return olFeature.getGeometry();
}

/** Zooms the map to a feature with animation and highlighting */
export async function zoomToFeature(
	map: OlMap,
	geometry: Geometry,
	highlightLayer: VectorLayer<VectorSource> | undefined,
	options: ZoomOptions = {}
): Promise<void> {
	const { padding = [50, 50, 50, 50], duration = 1000, maxZoom = 20, blinkCount = 6 } = options;

	const [{ default: Feature }] = await Promise.all([import('ol/Feature')]);

	const view = map.getView();
	const extent = geometry.getExtent();

	view.fit(extent, {
		duration: duration,
		padding: padding,
		maxZoom: maxZoom,
		callback: () => {
			if (highlightLayer) {
				const highlightFeature = new Feature(geometry);
				const source = highlightLayer.getSource();
				if (!source) return;
				let currentBlinkCount = 0;

				const blinkInterval = setInterval(() => {
					if (currentBlinkCount % 2 === 0) {
						source.addFeature(highlightFeature);
					} else {
						source.removeFeature(highlightFeature);
					}
					currentBlinkCount++;

					if (currentBlinkCount >= blinkCount) {
						clearInterval(blinkInterval);
						source.removeFeature(highlightFeature);
					}
				}, 300);
			}
		}
	});
}

/** Debounce function to limit API calls */
export function debounce<T extends (...args: Parameters<T>) => void>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/** Parse multiple GeoJSON features to OpenLayers geometries */
export async function parseMultipleFeatureGeometries(
	features: Record<string, unknown>[],
	fromProjection: string,
	toProjection: string | null = null
): Promise<(Geometry | undefined)[]> {
	const geometries = await Promise.all(
		features.map((feature) => parseFeatureGeometry(feature, fromProjection, toProjection))
	);
	return geometries;
}

/** Zooms the map to a bounding box extent with animation */
export function zoomToExtent(
	map: OlMap,
	extent: Extent,
	options: Omit<ZoomOptions, 'blinkCount'> = {}
): void {
	const { padding = [50, 50, 50, 50], duration = 800, maxZoom = 18 } = options;

	const view = map.getView();
	view.fit(extent, { duration, padding, maxZoom });
}

/** Zooms the map to multiple features with animation and highlighting */
export async function zoomToMultipleFeatures(
	map: OlMap,
	geometries: Geometry[],
	highlightLayer: VectorLayer<VectorSource>,
	options: ZoomOptions = {}
): Promise<void> {
	const { padding = [50, 50, 50, 50], duration = 1000, maxZoom = 17, blinkCount = 6 } = options;

	const [{ default: Feature }, { extend, createEmpty }] = await Promise.all([
		import('ol/Feature'),
		import('ol/extent')
	]);

	let combinedExtent = createEmpty();
	geometries.forEach((geometry) => {
		extend(combinedExtent, geometry.getExtent());
	});

	const view = map.getView();

	view.fit(combinedExtent, {
		duration: duration,
		padding: padding,
		maxZoom: maxZoom,
		callback: () => {
			if (highlightLayer) {
				const highlightFeatures = geometries.map((g) => new Feature(g));
				const source = highlightLayer.getSource();
				if (!source) return;
				let currentBlinkCount = 0;

				const blinkInterval = setInterval(() => {
					if (currentBlinkCount % 2 === 0) {
						highlightFeatures.forEach((f) => source.addFeature(f));
					} else {
						highlightFeatures.forEach((f) => source.removeFeature(f));
					}
					currentBlinkCount++;

					if (currentBlinkCount >= blinkCount) {
						clearInterval(blinkInterval);
						highlightFeatures.forEach((f) => {
							if (!source.hasFeature(f)) {
								source.addFeature(f);
							}
						});
					}
				}, 300);
			}
		}
	});
}
