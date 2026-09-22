import type OlMap from 'ol/Map.js';
import type { ProjectionLike } from 'ol/proj.js';
import WKT from 'ol/format/WKT.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';

import { createHighlightStyle, createRouteStyle } from '$lib/map/styles';

type OverlayMap = Pick<OlMap, 'addLayer' | 'removeLayer'> & {
	getView(): { getProjection(): ProjectionLike };
};

/**
 * Map overlay of the trench route: the calculated path between two trenches
 * and the layer a located trench blinks on.
 */
export class RouteOverlay {
	#map: OverlayMap | null = null;
	#routeLayer: VectorLayer<VectorSource> | null = null;
	#highlightLayer: VectorLayer<VectorSource> | null = null;

	/** Layer a located trench is highlighted on; `undefined` until the map is ready. */
	get highlightLayer(): VectorLayer<VectorSource> | undefined {
		return this.#highlightLayer ?? undefined;
	}

	/**
	 * Adds the route and highlight layers to the map.
	 * @param map - The OpenLayers map.
	 */
	attach(map: OverlayMap): void {
		this.#map = map;
		this.#routeLayer = new VectorLayer({
			source: new VectorSource(),
			style: createRouteStyle(),
			properties: { isHighlightLayer: true }
		});
		this.#highlightLayer = new VectorLayer({
			source: new VectorSource(),
			style: createHighlightStyle(),
			properties: { isHighlightLayer: true }
		});
		map.addLayer(this.#routeLayer);
		map.addLayer(this.#highlightLayer);
	}

	/**
	 * Draws a calculated route, replacing the previous one.
	 * @param pathWkt - Path geometry as WKT.
	 * @param dataProjection - Projection the WKT is expressed in.
	 */
	showRoute(pathWkt: string, dataProjection: ProjectionLike): void {
		if (!this.#map || !this.#routeLayer) return;

		const feature = new WKT().readFeature(pathWkt, {
			dataProjection,
			featureProjection: this.#map.getView().getProjection()
		});
		const source = this.#routeLayer.getSource();
		source?.clear();
		source?.addFeature(feature);
	}

	/** Removes the drawn route. */
	clear(): void {
		this.#routeLayer?.getSource()?.clear();
	}

	/** Removes both layers from the map. */
	detach(): void {
		if (this.#map) {
			if (this.#routeLayer) this.#map.removeLayer(this.#routeLayer);
			if (this.#highlightLayer) this.#map.removeLayer(this.#highlightLayer);
		}
		this.#routeLayer = null;
		this.#highlightLayer = null;
		this.#map = null;
	}
}
