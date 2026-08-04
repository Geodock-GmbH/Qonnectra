import type { Extent } from 'ol/extent';
import type OlFeature from 'ol/Feature';
import type OlMap from 'ol/Map';
import type Projection from 'ol/proj/Projection';
import type RenderFeature from 'ol/render/Feature';
import type VectorTileSource from 'ol/source/VectorTile';
import GeoJSON from 'ol/format/GeoJSON';
import Polygon from 'ol/geom/Polygon';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import VectorLayer from 'ol/layer/Vector';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorSource from 'ol/source/Vector';

import {
	createInquiryDrawingStyle,
	createInquiryHighlightPointStyle,
	createInquiryHighlightStyle,
	createInquiryPolygonStyleWithLabels
} from '$lib/map/styles';

const DRAWING_STYLE = createInquiryDrawingStyle();
const HIGHLIGHT_STYLE = createInquiryHighlightStyle();
const HIGHLIGHT_POINT_STYLE = createInquiryHighlightPointStyle();
const polygonStyleFunction = createInquiryPolygonStyleWithLabels();

interface HighlightSource {
	source: VectorTileSource;
	parentLayer: VectorTileLayer;
	isPoint: boolean;
}

interface GeoJsonFeature {
	type: string;
	geometry: Record<string, unknown>;
	properties?: Record<string, unknown>;
	[key: string]: unknown;
}

/**
 * Check if a RenderFeature intersects any of the given polygon geometries.
 * Use extent as a fast pre-filter, then verify with coordinate sampling.
 * @param feature - The render feature to test.
 * @param polygonGeometries - Polygon geometries to test against.
 */
function featureIntersectsPolygons(feature: RenderFeature, polygonGeometries: Polygon[]): boolean {
	const featureExtent: Extent = feature.getExtent();
	const flatCoords = feature.getFlatCoordinates();
	const type = feature.getType() as string;

	for (const polyGeom of polygonGeometries) {
		if (!polyGeom.intersectsExtent(featureExtent)) continue;

		if (type === 'Point') {
			if (polyGeom.intersectsCoordinate([flatCoords[0], flatCoords[1]])) return true;
		} else {
			for (let i = 0; i < flatCoords.length; i += 2) {
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
	olMap: OlMap | null = $state(null);
	isDrawing: boolean = $state(false);
	isEditing: boolean = $state(false);

	_polygonSource: VectorSource | null = null;
	_polygonLayer: VectorLayer | null = null;
	_highlightLayers: VectorTileLayer[] = [];
	_polygonGeometries: Polygon[] = [];
	_draw: Draw | null = null;
	_onDrawEnd: ((feature: OlFeature) => void) | null = null;
	_modify: Modify | null = null;
	_onModifyEnd: ((feature: OlFeature) => void) | null = null;

	/**
	 * Set up the polygon source and layer on the given map.
	 * @param olMap - OpenLayers map instance.
	 */
	initialize(olMap: OlMap | null): boolean {
		if (!olMap) return false;

		this.olMap = olMap;

		this._polygonSource = new VectorSource();
		this._polygonLayer = new VectorLayer({
			source: this._polygonSource,
			style: polygonStyleFunction,
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
	 * @param sources - Tile sources paired with their parent layers.
	 */
	initializeHighlightLayers(sources: HighlightSource[]): void {
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
					if (featureIntersectsPolygons(feature as RenderFeature, this._polygonGeometries)) {
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
	updatePolygonGeometryCache(): void {
		if (!this._polygonSource) {
			this._polygonGeometries = [];
			return;
		}
		this._polygonGeometries = this._polygonSource
			.getFeatures()
			.map((f) => f.getGeometry())
			.filter((g): g is Polygon => g instanceof Polygon);
	}

	/**
	 * Trigger a re-render of all highlight overlay layers.
	 */
	refreshHighlights(): void {
		for (const layer of this._highlightLayers) {
			layer.changed();
		}
	}

	/** Clear the polygon geometry cache and re-render highlights. */
	clearHighlights(): void {
		this._polygonGeometries = [];
		this.refreshHighlights();
	}

	/** Remove all highlight overlay layers from the map. */
	private _removeHighlightLayers(): void {
		if (!this.olMap) return;
		for (const layer of this._highlightLayers) {
			this.olMap.removeLayer(layer);
		}
		this._highlightLayers = [];
	}

	/**
	 * Start the polygon drawing interaction on the map.
	 * @param onDrawEnd - Callback invoked when a polygon is completed.
	 */
	startDrawing(onDrawEnd: (feature: OlFeature) => void): void {
		if (!this.olMap || !this._polygonSource) return;

		this.stopDrawing();
		this.stopEditing();

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
	stopDrawing(): void {
		if (this._draw && this.olMap) {
			this.olMap.removeInteraction(this._draw);
			this._draw = null;
		}
		this.isDrawing = false;
		this._onDrawEnd = null;
	}

	/**
	 * Start the polygon modify interaction on the map.
	 * @param onModifyEnd - Callback invoked for each modified polygon feature.
	 */
	startEditing(onModifyEnd: (feature: OlFeature) => void): void {
		if (!this.olMap || !this._polygonSource) return;

		this.stopEditing();
		this.stopDrawing();

		this._onModifyEnd = onModifyEnd;
		this.isEditing = true;

		this._modify = new Modify({
			source: this._polygonSource
		});

		this._modify.on('modifyend', (evt) => {
			const features = evt.features.getArray();
			for (const feature of features) {
				this._onModifyEnd?.(feature as OlFeature);
			}
		});

		this.olMap.addInteraction(this._modify);
	}

	/** Stop the active modify interaction and reset editing state. */
	stopEditing(): void {
		if (this._modify && this.olMap) {
			this.olMap.removeInteraction(this._modify);
			this._modify = null;
		}
		this.isEditing = false;
		this._onModifyEnd = null;
	}

	/**
	 * Render saved polygons from GeoJSON features onto the polygon layer.
	 * @param geoJsonFeatures - Array of GeoJSON feature objects to render.
	 * @param dataProjection - Projection of the input data.
	 * @param featureProjection - Target projection for the map.
	 */
	renderPolygons(
		geoJsonFeatures: GeoJsonFeature[],
		dataProjection: Projection | string | null,
		featureProjection: Projection | string | null
	): void {
		if (!this._polygonSource) return;

		this._polygonSource.clear();
		if (!geoJsonFeatures.length) return;

		const format = new GeoJSON();
		const readOptions: Record<string, unknown> = {};
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
	 * @param uuid - UUID of the polygon feature to remove.
	 */
	removePolygonByUuid(uuid: string): void {
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
	cleanup(): void {
		this.stopDrawing();
		this.stopEditing();

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
