import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import { unByKey } from 'ol/Observable';
import Overlay from 'ol/Overlay';
import VectorSource from 'ol/source/Vector';
import { getArea, getLength } from 'ol/sphere';

import { createMeasureStyle } from '$lib/map/styles.js';

const MEASURE_STYLE = createMeasureStyle();

/**
 * Manages measurement interactions on the OpenLayers map.
 * Supports distance (LineString) and area (Polygon) measurements
 * with live tooltip overlays showing formatted results.
 */
export class MapMeasureManager {
	/** @type {import('ol/Map').default | null} */
	olMap = $state(null);
	/** @type {boolean} */
	isMeasuring = $state(false);
	/** @type {'distance' | 'area' | null} */
	measureType = $state(null);

	/** @type {VectorSource | null} */
	_source = null;
	/** @type {VectorLayer | null} */
	_layer = null;
	/** @type {Draw | null} */
	_draw = null;
	/** @type {Overlay | null} */
	_measureTooltip = null;
	/** @type {HTMLDivElement | null} */
	_measureTooltipElement = null;
	/** @type {import('ol/events').EventsKey | null} */
	_geometryChangeListener = null;
	/** @type {import('ol/Feature').default | null} */
	_sketch = null;
	/** @type {Overlay[]} */
	_overlays = [];

	/**
	 * @param {number} lengthInMeters
	 * @returns {string}
	 */
	static formatLength(lengthInMeters) {
		if (lengthInMeters >= 100) {
			return `${Math.round((lengthInMeters / 1000) * 100) / 100} km`;
		}
		return `${Math.round(lengthInMeters * 100) / 100} m`;
	}

	/**
	 * @param {number} areaInSqMeters
	 * @returns {string}
	 */
	static formatArea(areaInSqMeters) {
		if (areaInSqMeters >= 10000) {
			return `${Math.round((areaInSqMeters / 1000000) * 100) / 100} km²`;
		}
		return `${Math.round(areaInSqMeters * 100) / 100} m²`;
	}

	/**
	 * @param {import('ol/Map').default | null} olMap
	 * @returns {boolean}
	 */
	initialize(olMap) {
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

	/**
	 * @param {'distance' | 'area'} type
	 */
	startMeasure(type) {
		if (!this.olMap) return;

		if (this.isMeasuring) {
			this._clearCurrentMeasurement();
			this._removeDrawInteraction();
		}

		this.measureType = type;
		this.isMeasuring = true;

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
					/** @type {import('ol/coordinate').Coordinate | undefined} */
					let tooltipCoord;

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

	stopMeasure() {
		this._clearCurrentMeasurement();
		this._removeDrawInteraction();
		this.isMeasuring = false;
		this.measureType = null;
	}

	/** @private */
	_clearCurrentMeasurement() {
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
	_removeDrawInteraction() {
		if (this._draw && this.olMap) {
			this.olMap.removeInteraction(this._draw);
			this._draw = null;
		}
	}

	/** @private */
	_createMeasureTooltip() {
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

	cleanup() {
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
