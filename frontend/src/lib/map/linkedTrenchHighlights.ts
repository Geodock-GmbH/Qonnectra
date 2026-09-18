import type OlMap from 'ol/Map.js';
import type VectorTileSource from 'ol/source/VectorTile.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';

import { createLinkedTrenchStyle } from '$lib/map/styles';

type HighlightedMap = Pick<OlMap, 'addLayer' | 'removeLayer'>;

/**
 * Map overlay that highlights every trench a conduit runs through while that
 * conduit is open in the drawer. Several conduits can be highlighted at once;
 * a trench stays highlighted while at least one open conduit uses it.
 */
export class LinkedTrenchHighlights {
	#trenchesByConduit = new Map<string, string[]>();
	#highlighted = new Set<string>();
	#layer: VectorTileLayer | null = null;
	#map: HighlightedMap | null = null;
	#visible = true;

	/**
	 * Adds the highlight layer to the map, drawing from the trench tile source.
	 * @param map - The OpenLayers map.
	 * @param source - Tile source of the trench layer.
	 */
	attach(map: HighlightedMap, source: VectorTileSource | null | undefined): void {
		const style = createLinkedTrenchStyle();
		this.#map = map;
		this.#layer = new VectorTileLayer({
			renderMode: 'vector',
			source: source ?? undefined,
			style: (feature) => {
				const featureId = feature.getId();
				return featureId && this.#highlighted.has(String(featureId)) ? style : undefined;
			},
			visible: this.#visible,
			properties: { isHighlightLayer: true }
		});
		map.addLayer(this.#layer);
	}

	/**
	 * Shows or hides the overlay without forgetting what is highlighted.
	 * @param visible - Whether the highlights are drawn.
	 */
	setVisible(visible: boolean): void {
		this.#visible = visible;
		this.#layer?.setVisible(visible);
	}

	/**
	 * Points the overlay at another tile source. Switching the project
	 * replaces the trench layer's source, which the overlay has to follow.
	 * @param source - The trench layer's current tile source.
	 */
	setSource(source: VectorTileSource | null | undefined): void {
		this.#layer?.setSource(source ?? null);
	}

	/**
	 * Highlights the trenches of a conduit.
	 * @param conduitUuid - UUID of the conduit.
	 * @param trenchUuids - UUIDs of the trenches the conduit runs through.
	 */
	show(conduitUuid: string, trenchUuids: string[]): void {
		this.#trenchesByConduit.set(conduitUuid, trenchUuids);
		this.#redraw();
	}

	/**
	 * Drops the highlight of a conduit.
	 * @param conduitUuid - UUID of the conduit.
	 */
	hide(conduitUuid: string): void {
		if (this.#trenchesByConduit.delete(conduitUuid)) this.#redraw();
	}

	/** Drops every highlight. */
	clear(): void {
		if (this.#trenchesByConduit.size === 0) return;
		this.#trenchesByConduit.clear();
		this.#redraw();
	}

	/**
	 * Whether a trench is currently highlighted.
	 * @param trenchUuid - UUID of the trench.
	 */
	isHighlighted(trenchUuid: string): boolean {
		return this.#highlighted.has(trenchUuid);
	}

	/** Removes the highlight layer from the map. */
	detach(): void {
		if (this.#map && this.#layer) this.#map.removeLayer(this.#layer);
		this.#layer = null;
		this.#map = null;
		this.#trenchesByConduit.clear();
		this.#highlighted.clear();
	}

	#redraw(): void {
		this.#highlighted = new Set([...this.#trenchesByConduit.values()].flat());
		this.#layer?.changed();
	}
}
