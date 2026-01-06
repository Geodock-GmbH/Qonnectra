import { Circle as CircleStyle, Style } from 'ol/style';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';

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
 * Creates a text style with customizable options
 * @param {Object} options - Text style options
 * @param {string} options.text - The text to display
 * @param {string} [options.font='12px Calibri,sans-serif'] - Font for the text
 * @param {string} [options.fillColor='#000'] - Fill color for the text
 * @param {string} [options.strokeColor='#fff'] - Stroke color for text outline
 * @param {number} [options.strokeWidth=3] - Width of text outline
 * @param {number} [options.offsetX=15] - Horizontal offset from feature
 * @param {number} [options.offsetY=15] - Vertical offset from feature
 * @param {string} [options.textAlign='center'] - Text alignment
 * @returns {Text}
 */
export function createTextStyle(options) {
	const {
		text,
		font = '12px Calibri,sans-serif',
		fillColor = '#000',
		strokeColor = '#fff',
		strokeWidth = 3,
		offsetX = 15,
		offsetY = 15,
		textAlign = 'center'
	} = options;

	return new Text({
		text,
		font,
		fill: new Fill({ color: fillColor }),
		stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
		offsetX,
		offsetY,
		textAlign
	});
}

/**
 * Creates a style function for trench features with optional labels
 * @param {string} color - The color for the trench style
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='id_trench'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.5] - Minimum resolution to show labels (more zoomed in)
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createTrenchStyleWithLabels(color, labelOptions = {}) {
	const {
		enabled = false,
		field = 'id_trench',
		minResolution = 1.5,
		textStyle = {}
	} = labelOptions;

	// Cache the geometry style since it never changes for this color
	const geometryStyle = new Style({
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
		}),
		declutterMode: 'none'
	});

	return function (feature, resolution) {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
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
			stroke: new Stroke({ color: '#000000', width: 1 })
		})
	});
}

/**
 * Creates a style function for address points with optional labels
 * Labels display: street + house_number + house_number_suffix (if present)
 * @param {string} [color=DEFAULT_ADDRESS_COLOR] - The color for the address point
 * @param {number} [size=DEFAULT_ADDRESS_SIZE] - The radius for the address point
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels (more zoomed in)
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createAddressStyleWithLabels(
	color = DEFAULT_ADDRESS_COLOR,
	size = DEFAULT_ADDRESS_SIZE,
	labelOptions = {}
) {
	const { enabled = false, minResolution = 1.0, textStyle = {} } = labelOptions;

	// Cache the geometry style since it never changes
	const geometryStyle = new Style({
		image: new CircleStyle({
			radius: size,
			fill: new Fill({ color: color }),
			stroke: new Stroke({ color: '#000000', width: 1 })
		}),
		declutterMode: 'none'
	});

	return function (feature, resolution) {
		if (enabled && resolution < minResolution) {
			const street = feature.get('street') || '';
			const houseNumber = feature.get('housenumber') || '';
			const suffix = feature.get('house_number_suffix');
			const postalCode = feature.get('zip_code') || '';
			const city = feature.get('city') || '';
			const labelText = `${street} ${houseNumber}${suffix || ''}, ${postalCode} ${city}`.trim();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
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
			stroke: new Stroke({ color: '#000000', width: 1 })
		})
	});
}

/**
 * Creates a style function for node points with optional labels
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels (more zoomed in)
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createNodeStyleWithLabels(labelOptions = {}) {
	const { enabled = false, field = 'name', minResolution = 1.0, textStyle = {} } = labelOptions;

	// Cache the geometry style since it never changes
	const geometryStyle = new Style({
		image: new CircleStyle({
			radius: 6,
			fill: new Fill({ color: '#ff6b35' }),
			stroke: new Stroke({ color: '#000000', width: 1 })
		}),
		declutterMode: 'none'
	});

	return function (feature, resolution) {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Default node style configuration
 */
export const DEFAULT_NODE_COLOR = '#ff6b35';
export const DEFAULT_NODE_SIZE = 6;

/**
 * Default trench style configuration
 */
export const DEFAULT_TRENCH_COLOR = '#fbb483';
export const DEFAULT_TRENCH_WIDTH = 2;

/**
 * Default address style configuration
 */
export const DEFAULT_ADDRESS_COLOR = '#2563eb';
export const DEFAULT_ADDRESS_SIZE = 4;

/**
 * Creates a style function for node points with per-type styling
 * @param {Object} nodeTypeStyles - Object mapping node type names to style config
 *   { [node_type]: { color: '#hex', size: number, visible: boolean } }
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createNodeStyleByType(nodeTypeStyles = {}, labelOptions = {}) {
	const { enabled = false, field = 'name', minResolution = 1.0, textStyle = {} } = labelOptions;

	const geometryStyleCache = new Map();

	return function (feature, resolution) {
		const nodeType = feature.get('node_type');
		const typeConfig = nodeTypeStyles[nodeType] || {
			color: DEFAULT_NODE_COLOR,
			size: DEFAULT_NODE_SIZE,
			visible: true
		};

		if (!typeConfig.visible) {
			return null;
		}

		const geometryCacheKey = `${nodeType || 'default'}_${typeConfig.color}_${typeConfig.size}`;

		// Get or create geometry-only style (always rendered, never decluttered)
		let geometryStyle = geometryStyleCache.get(geometryCacheKey);
		if (!geometryStyle) {
			geometryStyle = new Style({
				image: new CircleStyle({
					radius: typeConfig.size || DEFAULT_NODE_SIZE,
					fill: new Fill({ color: typeConfig.color || DEFAULT_NODE_COLOR }),
					stroke: new Stroke({ color: '#000000', width: 1 })
				}),
				// Mark as non-declutterable so the point always renders
				declutterMode: 'none'
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const showLabels = enabled && resolution < minResolution;

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			// Create separate label style that can be decluttered
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				// Labels can be decluttered (hidden when overlapping)
				declutterMode: 'declutter'
			});
			// Return both styles - geometry always shows, label may be hidden
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates a style function for trench features with per-attribute styling
 * @param {Object} attributeStyles - Object mapping attribute values to style config
 *   { [attribute_value]: { color: '#hex', visible: boolean } }
 * @param {string} styleMode - 'surface' | 'construction_type' | 'none'
 * @param {string} fallbackColor - Color to use when styleMode is 'none' or attribute not found
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='id_trench'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.5] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createTrenchStyleByAttribute(
	attributeStyles = {},
	styleMode = 'none',
	fallbackColor = DEFAULT_TRENCH_COLOR,
	labelOptions = {}
) {
	const {
		enabled = false,
		field = 'id_trench',
		minResolution = 1.5,
		textStyle = {}
	} = labelOptions;

	const geometryStyleCache = new Map();

	return function (feature, resolution) {
		let color = fallbackColor;
		let visible = true;

		// Determine color based on style mode
		if (styleMode === 'surface') {
			const surfaceValue = feature.get('surface');
			const config = attributeStyles[surfaceValue];
			if (config) {
				color = config.color || fallbackColor;
				visible = config.visible !== false;
			}
		} else if (styleMode === 'construction_type') {
			const constructionTypeValue = feature.get('construction_type');
			const config = attributeStyles[constructionTypeValue];
			if (config) {
				color = config.color || fallbackColor;
				visible = config.visible !== false;
			}
		}

		// Return null if this attribute value should be hidden
		if (!visible) {
			return null;
		}

		const geometryCacheKey = `${styleMode}_${color}`;

		// Get or create geometry style (never decluttered)
		let geometryStyle = geometryStyleCache.get(geometryCacheKey);
		if (!geometryStyle) {
			geometryStyle = new Style({
				fill: new Fill({
					color: color
				}),
				stroke: new Stroke({
					color: color,
					width: DEFAULT_TRENCH_WIDTH
				}),
				image: new CircleStyle({
					radius: 7,
					fill: new Fill({ color: color }),
					stroke: new Stroke({ color: color, width: 2 })
				}),
				declutterMode: 'none'
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const showLabels = enabled && resolution < minResolution;

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}
