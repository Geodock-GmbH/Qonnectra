import GeoJSON from 'ol/format/GeoJSON';
import Polygon from 'ol/geom/Polygon';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';

const POLYGON_STYLE = new Style({
	fill: new Fill({ color: 'rgba(59, 130, 246, 0.15)' }),
	stroke: new Stroke({ color: '#3b82f6', width: 2 })
});

const DRAWING_STYLE = new Style({
	fill: new Fill({ color: 'rgba(59, 130, 246, 0.1)' }),
	stroke: new Stroke({ color: '#3b82f6', width: 2, lineDash: [6, 4] })
});

const HIGHLIGHT_STYLE = new Style({
	fill: new Fill({ color: 'rgba(251, 191, 36, 0.4)' }),
	stroke: new Stroke({ color: '#f59e0b', width: 3 })
});

const HIGHLIGHT_POINT_STYLE = new Style({
	image: new CircleStyle({
		radius: 6,
		fill: new Fill({ color: 'rgba(251, 191, 36, 0.6)' }),
		stroke: new Stroke({ color: '#f59e0b', width: 2 })
	})
});

/**
 * Check if a RenderFeature intersects any of the given polygon geometries.
 * Use extent as a fast pre-filter, then verify with coordinate sampling.
 * @param {import('ol/render/Feature').default} feature - The render feature to test.
 * @param {Polygon[]} polygonGeometries - Polygon geometries to test against.
 * @returns {boolean} Whether the feature intersects at least one polygon.
 */
function featureIntersectsPolygons(feature, polygonGeometries) {
	const featureExtent = feature.getExtent();
	const flatCoords = feature.getFlatCoordinates();
	const type = feature.getType();

	for (const polyGeom of polygonGeometries) {
		if (!polyGeom.intersectsExtent(featureExtent)) continue;

		if (type === 'Point') {
			if (polyGeom.intersectsCoordinate([flatCoords[0], flatCoords[1]])) return true;
		} else {
			const stride = type === 'Polygon' || type === 'MultiPolygon' ? 2 : 2;
			for (let i = 0; i < flatCoords.length; i += stride) {
				if (polyGeom.intersectsCoordinate([flatCoords[i], flatCoords[i + 1]])) return true;
			}
		}
	}
	return false;
}

/**
 * Manages polygon drawing and feature highlighting for pipeline inquiries.
 * Uses VectorTile overlay layers for efficient spatial highlighting.
 */
export class InquiryDrawManager {
	/** @type {import('ol/Map').default | null} */
	olMap = $state(null);
	/** @type {boolean} */
	isDrawing = $state(false);

	/** @type {VectorSource | null} */
	_polygonSource = null;
	/** @type {VectorLayer | null} */
	_polygonLayer = null;
	/** @type {VectorTileLayer[]} */
	_highlightLayers = [];
	/** @type {Polygon[]} */
	_polygonGeometries = [];
	/** @type {Draw | null} */
	_draw = null;
	/** @type {((feature: import('ol/Feature').default) => void) | null} */
	_onDrawEnd = null;

	/**
	 * Set up the polygon source and layer on the given map.
	 * @param {import('ol/Map').default | null} olMap - OpenLayers map instance.
	 * @returns {boolean} Whether initialization succeeded.
	 */
	initialize(olMap) {
		if (!olMap) return false;

		this.olMap = olMap;

		this._polygonSource = new VectorSource();
		this._polygonLayer = new VectorLayer({
			source: this._polygonSource,
			style: POLYGON_STYLE,
			zIndex: 80
		});
		this._polygonLayer.set('isInquiryLayer', true);

		this.olMap.addLayer(this._polygonLayer);

		return true;
	}

	/**
	 * Create highlight overlay layers that share tile sources with data layers.
	 * Each overlay renders only features whose extent intersects with drawn polygons
	 * and only when the parent data layer is visible.
	 * @param {Array<{source: import('ol/source/VectorTile').default, parentLayer: import('ol/layer/VectorTile').default, isPoint: boolean}>} sources - Tile sources paired with their parent layers.
	 */
	initializeHighlightLayers(sources) {
		if (!this.olMap) return;

		this._removeHighlightLayers();

		for (const { source, parentLayer, isPoint } of sources) {
			const style = isPoint ? HIGHLIGHT_POINT_STYLE : HIGHLIGHT_STYLE;
			const layer = new VectorTileLayer({
				renderMode: 'vector',
				source: source,
				style: (feature) => {
					if (this._polygonGeometries.length === 0) return undefined;
					if (!parentLayer.getVisible()) return undefined;
					if (featureIntersectsPolygons(feature, this._polygonGeometries)) {
						return style;
					}
					return undefined;
				},
				zIndex: 70,
				properties: {
					isHighlightLayer: true
				}
			});
			this._highlightLayers.push(layer);
			this.olMap.addLayer(layer);
		}
	}

	/**
	 * Update the cached polygon geometries from the polygon source.
	 */
	updatePolygonGeometryCache() {
		if (!this._polygonSource) {
			this._polygonGeometries = [];
			return;
		}
		this._polygonGeometries = this._polygonSource
			.getFeatures()
			.map((f) => f.getGeometry())
			.filter((g) => g instanceof Polygon);
	}

	/**
	 * Trigger a re-render of all highlight overlay layers.
	 */
	refreshHighlights() {
		for (const layer of this._highlightLayers) {
			layer.changed();
		}
	}

	/** Clear the polygon geometry cache and re-render highlights. */
	clearHighlights() {
		this._polygonGeometries = [];
		this.refreshHighlights();
	}

	/** @private Remove all highlight overlay layers from the map. */
	_removeHighlightLayers() {
		if (!this.olMap) return;
		for (const layer of this._highlightLayers) {
			this.olMap.removeLayer(layer);
		}
		this._highlightLayers = [];
	}

	/**
	 * Start the polygon drawing interaction on the map.
	 * @param {(feature: import('ol/Feature').default) => void} onDrawEnd - Callback invoked when a polygon is completed.
	 */
	startDrawing(onDrawEnd) {
		if (!this.olMap || !this._polygonSource) return;

		this.stopDrawing();

		this._onDrawEnd = onDrawEnd;
		this.isDrawing = true;

		this._draw = new Draw({
			source: this._polygonSource,
			type: 'Polygon',
			style: DRAWING_STYLE
		});

		this._draw.on('drawend', (evt) => {
			this._onDrawEnd?.(evt.feature);
		});

		this.olMap.addInteraction(this._draw);
	}

	/** Stop the active drawing interaction and reset drawing state. */
	stopDrawing() {
		if (this._draw && this.olMap) {
			this.olMap.removeInteraction(this._draw);
			this._draw = null;
		}
		this.isDrawing = false;
		this._onDrawEnd = null;
	}

	/**
	 * Render saved polygons from GeoJSON features onto the polygon layer.
	 * @param {any[]} geoJsonFeatures - Array of GeoJSON feature objects to render.
	 * @param {import('ol/proj/Projection').default | string | null} dataProjection - Projection of the input data.
	 * @param {import('ol/proj/Projection').default | string | null} featureProjection - Target projection for the map.
	 */
	renderPolygons(geoJsonFeatures, dataProjection, featureProjection) {
		if (!this._polygonSource) return;

		this._polygonSource.clear();
		if (!geoJsonFeatures.length) return;

		const format = new GeoJSON();
		const readOptions = /** @type {any} */ ({});
		if (dataProjection) readOptions.dataProjection = dataProjection;
		if (featureProjection) readOptions.featureProjection = featureProjection;

		for (const geoJson of geoJsonFeatures) {
			const featureCollection = {
				type: 'FeatureCollection',
				features: [geoJson]
			};
			const features = format.readFeatures(featureCollection, readOptions);
			this._polygonSource.addFeatures(features);
		}
	}

	/**
	 * Remove a polygon by its UUID from the polygon layer.
	 * @param {string} uuid - UUID of the polygon feature to remove.
	 */
	removePolygonByUuid(uuid) {
		if (!this._polygonSource) return;

		const features = this._polygonSource.getFeatures();
		for (const feature of features) {
			if (feature.get('uuid') === uuid) {
				this._polygonSource.removeFeature(feature);
				break;
			}
		}
	}

	/** Remove all layers and interactions, reset internal state. */
	cleanup() {
		this.stopDrawing();

		if (this._polygonLayer && this.olMap) {
			this.olMap.removeLayer(this._polygonLayer);
		}
		this._removeHighlightLayers();

		if (this._polygonSource) {
			this._polygonSource.clear();
			this._polygonSource = null;
		}

		this._polygonGeometries = [];
		this._polygonLayer = null;
		this.olMap = null;
	}
}
