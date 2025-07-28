// OpenLayers
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import { Style, Circle as CircleStyle } from 'ol/style';

/**
 * Creates a style for trench features
 * @param {string} color - The color for the trench style
 * @returns {Style}
 */
export function createTrenchStyle(color) {
	return new Style({
		fill: new Fill({
			color: color
		}),
		stroke: new Stroke({
			color: color,
			width: 2
		}),
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: color }),
			stroke: new Stroke({ color: color, width: 2 })
		})
	});
}

/**
 * Creates a style for selected features
 * @param {string} color - The color for the selected style
 * @returns {Style}
 */
export function createSelectedStyle(color) {
	return new Style({
		fill: new Fill({
			color: color
		}),
		stroke: new Stroke({
			color: color,
			width: 3
		}),
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: color }),
			stroke: new Stroke({ color: color, width: 2 })
		})
	});
}

/**
 * Creates a style for address points
 * @returns {Style}
 */
export function createAddressStyle() {
	return new Style({
		image: new CircleStyle({
			radius: 4,
			fill: new Fill({ color: '#2563eb' }),
			stroke: new Stroke({ color: '#ffffff', width: 1 })
		})
	});
}

/**
 * Creates a style for node points
 * @returns {Style}
 */
export function createNodeStyle() {
	return new Style({
		image: new CircleStyle({
			radius: 6,
			fill: new Fill({ color: '#ff6b35' }),
			stroke: new Stroke({ color: '#ffffff', width: 1 })
		})
	});
}
