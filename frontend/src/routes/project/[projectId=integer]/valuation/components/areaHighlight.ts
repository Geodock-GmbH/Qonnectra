import type { StorageProjection } from '$lib/map/projectionUtils.js';
import type { ValuationArea } from '$lib/remote/valuation/valuation-data';
import type BaseLayer from 'ol/layer/Base.js';
import type { ProjectionLike } from 'ol/proj.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style } from 'ol/style.js';

import { storageReadOptions } from '$lib/map/projectionUtils.js';

/** The part of an OpenLayers map the overlay draws on. */
export interface HighlightedMap {
	addLayer(layer: BaseLayer): void;
	removeLayer(layer: BaseLayer): unknown;
	getView(): { getProjection(): ProjectionLike };
}

/** Map overlay that outlines the areas a valuation is restricted to. */
export class AreaHighlight {
	#map: HighlightedMap | null = null;
	#storage: StorageProjection | null = null;
	#areas: ValuationArea[] = [];

	readonly source = new VectorSource();

	readonly #layer = new VectorLayer({
		source: this.source,
		style: new Style({
			stroke: new Stroke({ color: '#f59e0b', width: 3 }),
			fill: new Fill({ color: 'rgba(245, 158, 11, 0.15)' })
		}),
		zIndex: 90
	});

	/**
	 * Adds the overlay to a map and draws areas that were shown before the map was ready.
	 * @param map - The map to draw on.
	 * @param storage - Projection the area geometries arrive in.
	 */
	attach(map: HighlightedMap, storage: StorageProjection | null): void {
		this.#map = map;
		this.#storage = storage;
		map.addLayer(this.#layer);
		this.#redraw();
	}

	/** Removes the overlay from the map it was attached to. */
	detach(): void {
		this.#map?.removeLayer(this.#layer);
		this.#map = null;
	}

	/**
	 * Outlines the given areas, replacing the previous outlines.
	 * @param areas - The areas to outline; areas without a geometry are skipped.
	 */
	show(areas: ValuationArea[]): void {
		this.#areas = areas;
		this.#redraw();
	}

	/** Redraws the outlines of the shown areas; draws nothing until a map is attached. */
	#redraw(): void {
		this.source.clear();
		if (!this.#map) return;

		const readOptions = storageReadOptions(this.#storage, this.#map.getView().getProjection());
		const format = new GeoJSON();

		for (const area of this.#areas) {
			if (!area.geometry) continue;
			this.source.addFeatures(
				format.readFeatures(
					{ type: 'Feature', geometry: area.geometry, properties: {} },
					readOptions
				)
			);
		}
	}
}
