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

	return function (feature, resolution) {
		const baseStyle = createTrenchStyle(color);

		// Only add text if labels are enabled and resolution is high enough (zoomed in)
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const text = createTextStyle({ text: labelText, ...textStyle });
			baseStyle.setText(text);
		}

		return baseStyle;
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
			stroke: new Stroke({ color: '#ffffff', width: 1 })
		})
	});
}

/**
 * Creates a style function for address points with optional labels
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='street'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels (more zoomed in)
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createAddressStyleWithLabels(labelOptions = {}) {
	const { enabled = false, field = 'street', minResolution = 1.0, textStyle = {} } = labelOptions;

	return function (feature, resolution) {
		const baseStyle = createAddressStyle();

		// Only add text if labels are enabled and resolution is high enough (zoomed in)
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const text = createTextStyle({ text: labelText, ...textStyle });
			baseStyle.setText(text);
		}

		return baseStyle;
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
			stroke: new Stroke({ color: '#ffffff', width: 1 })
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

	return function (feature, resolution) {
		const baseStyle = createNodeStyle();

		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const text = createTextStyle({ text: labelText, ...textStyle });
			baseStyle.setText(text);
		}

		return baseStyle;
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

	const styleCache = new Map();

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

		const showLabels = enabled && resolution < minResolution;
		const cacheKey = `${nodeType || 'default'}_${typeConfig.color}_${typeConfig.size}_${showLabels}`;

		if (styleCache.has(cacheKey)) {
			const cachedStyle = styleCache.get(cacheKey);
			if (showLabels) {
				const labelText = (feature.get(field) || '').toString();
				cachedStyle.getText()?.setText(labelText);
			}
			return cachedStyle;
		}

		const style = new Style({
			image: new CircleStyle({
				radius: typeConfig.size || DEFAULT_NODE_SIZE,
				fill: new Fill({ color: typeConfig.color || DEFAULT_NODE_COLOR }),
				stroke: new Stroke({ color: '#ffffff', width: 1 })
			})
		});

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const text = createTextStyle({ text: labelText, ...textStyle });
			style.setText(text);
		}

		if (!showLabels) {
			styleCache.set(cacheKey, style);
		}

		return style;
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

	const styleCache = new Map();

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

		const showLabels = enabled && resolution < minResolution;
		const cacheKey = `${styleMode}_${color}_${showLabels}`;

		if (styleCache.has(cacheKey)) {
			const cachedStyle = styleCache.get(cacheKey);
			if (showLabels) {
				const labelText = (feature.get(field) || '').toString();
				cachedStyle.getText()?.setText(labelText);
			}
			return cachedStyle;
		}

		const style = new Style({
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
			})
		});

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const text = createTextStyle({ text: labelText, ...textStyle });
			style.setText(text);
		}

		if (!showLabels) {
			styleCache.set(cacheKey, style);
		}

		return style;
	};
}
