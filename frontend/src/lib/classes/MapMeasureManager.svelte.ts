import type { Coordinate } from 'ol/coordinate.js';
import type { EventsKey } from 'ol/events.js';
import type Feature from 'ol/Feature.js';
import type OlMap from 'ol/Map.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import Draw from 'ol/interaction/Draw.js';
import VectorLayer from 'ol/layer/Vector.js';
import { unByKey } from 'ol/Observable.js';
import Overlay from 'ol/Overlay.js';
import VectorSource from 'ol/source/Vector.js';
import { getArea, getLength } from 'ol/sphere.js';

import { createMeasureStyle } from '$lib/map/styles';

const MEASURE_STYLE = createMeasureStyle();

/**
 * Manages measurement interactions on the OpenLayers map.
 * Supports distance (LineString) and area (Polygon) measurements
 * with live tooltip overlays showing formatted results.
 */
export class MapMeasureManager {
	olMap: OlMap | null = $state(null);
	isMeasuring: boolean = $state(false);
	measureType: 'distance' | 'area' | null = $state(null);

	_source: VectorSource | null = null;
	_layer: VectorLayer | null = null;
	_draw: Draw | null = null;
	_measureTooltip: Overlay | null = null;
	_measureTooltipElement: HTMLDivElement | null = null;
	_geometryChangeListener: EventsKey | null = null;
	_sketch: Feature | null = null;
	_overlays: Overlay[] = [];

	static formatLength(lengthInMeters: number): string {
		if (lengthInMeters >= 100) {
			return `${Math.round((lengthInMeters / 1000) * 100) / 100} km`;
		}
		return `${Math.round(lengthInMeters * 100) / 100} m`;
	}

	static formatArea(areaInSqMeters: number): string {
		if (areaInSqMeters >= 10000) {
			return `${Math.round((areaInSqMeters / 1000000) * 100) / 100} km²`;
		}
		return `${Math.round(areaInSqMeters * 100) / 100} m²`;
	}

	initialize(olMap: OlMap | null): boolean {
		if (!olMap) return false;

		this.olMap = olMap;
		this._source = new VectorSource();
		this._layer = new VectorLayer({
			source: this._source,
			style: MEASURE_STYLE
		});
		this._layer.set('isMeasureLayer', true);
		this.olMap.addLayer(this._layer);

		return true;
	}

	startMeasure(type: 'distance' | 'area'): void {
		if (!this.olMap) return;

		if (this.isMeasuring) {
			this._clearCurrentMeasurement();
			this._removeDrawInteraction();
		}

		this.measureType = type;
		this.isMeasuring = true;

		this.olMap.getViewport().style.cursor = 'crosshair';

		const drawType = type === 'area' ? 'Polygon' : 'LineString';
		this._draw = new Draw({
			source: this._source ?? undefined,
			type: drawType,
			style: MEASURE_STYLE
		});

		this._draw.on('drawstart', (evt) => {
			this._clearCurrentMeasurement();
			this._sketch = evt.feature;

			this._createMeasureTooltip();

			const geom = this._sketch.getGeometry();
			if (geom) {
				this._geometryChangeListener = geom.on('change', (changeEvt) => {
					const geometry = changeEvt.target;
					let output = '';
					let tooltipCoord: Coordinate | undefined;

					if (geometry instanceof Polygon) {
						output = MapMeasureManager.formatArea(getArea(geometry));
						tooltipCoord = geometry.getInteriorPoint().getCoordinates();
					} else if (geometry instanceof LineString) {
						output = MapMeasureManager.formatLength(getLength(geometry));
						tooltipCoord = geometry.getLastCoordinate();
					}

					if (this._measureTooltipElement) {
						this._measureTooltipElement.innerHTML = output;
					}
					if (this._measureTooltip && tooltipCoord) {
						this._measureTooltip.setPosition(tooltipCoord);
					}
				});
			}
		});

		this._draw.on('drawend', () => {
			if (this._measureTooltipElement) {
				this._measureTooltipElement.classList.remove('ol-measure-tooltip-active');
				this._measureTooltipElement.classList.add('ol-measure-tooltip-static');
			}
			if (this._measureTooltip) {
				this._measureTooltip.setOffset([0, -7]);
			}

			this._sketch = null;
			if (this._geometryChangeListener) {
				unByKey(this._geometryChangeListener);
				this._geometryChangeListener = null;
			}

			this._measureTooltipElement = null;
			this._measureTooltip = null;
		});

		this.olMap.addInteraction(this._draw);
	}

	stopMeasure(): void {
		this._clearCurrentMeasurement();
		this._removeDrawInteraction();
		this.isMeasuring = false;
		this.measureType = null;

		if (this.olMap) {
			this.olMap.getViewport().style.cursor = 'default';
		}
	}

	/** @private */
	_clearCurrentMeasurement(): void {
		if (this._geometryChangeListener) {
			unByKey(this._geometryChangeListener);
			this._geometryChangeListener = null;
		}
		this._sketch = null;

		if (this._source) {
			this._source.clear();
		}

		for (const overlay of this._overlays) {
			if (this.olMap) {
				this.olMap.removeOverlay(overlay);
			}
			const el = overlay.getElement();
			if (el) el.remove();
		}
		this._overlays = [];

		this._measureTooltipElement = null;
		this._measureTooltip = null;
	}

	/** @private */
	_removeDrawInteraction(): void {
		if (this._draw && this.olMap) {
			this.olMap.removeInteraction(this._draw);
			this._draw = null;
		}
	}

	/** @private */
	_createMeasureTooltip(): void {
		this._measureTooltipElement = document.createElement('div');
		this._measureTooltipElement.className = 'ol-measure-tooltip ol-measure-tooltip-active';

		this._measureTooltip = new Overlay({
			element: this._measureTooltipElement,
			offset: [0, -15],
			positioning: 'bottom-center',
			stopEvent: false,
			insertFirst: false
		});

		this.olMap?.addOverlay(this._measureTooltip);
		this._overlays.push(this._measureTooltip);
	}

	cleanup(): void {
		this.stopMeasure();

		if (this._layer && this.olMap) {
			this.olMap.removeLayer(this._layer);
		}

		if (this._source) {
			this._source.clear();
			this._source = null;
		}

		this._layer = null;
		this.olMap = null;
	}
}
