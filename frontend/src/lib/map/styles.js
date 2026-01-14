import { Circle as CircleStyle, Style } from 'ol/style';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';

/**
 * Creates a style function for trench features with optional trench and conduit labels
 * @param {string} color - The color for the trench style
 * @param {Object} [labelOptions={}] - Trench label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show trench labels
 * @param {string} [labelOptions.field='id_trench'] - Feature property to use for trench label
 * @param {number} [labelOptions.minResolution=1.5] - Minimum resolution to show trench labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options for trench labels
 * @param {Object} [conduitLabelOptions={}] - Conduit label configuration options
 * @param {boolean} [conduitLabelOptions.enabled=false] - Whether to show conduit labels
 * @param {string} [conduitLabelOptions.field='conduit_names'] - Feature property to use for conduit label
 * @param {number} [conduitLabelOptions.minResolution=1.5] - Minimum resolution to show conduit labels
 * @param {Object} [conduitLabelOptions.textStyle] - Custom text style options for conduit labels
 * @returns {Style|Function} Style or style function that accepts (feature, resolution)
 */
export function createTrenchStyle(color, labelOptions = {}, conduitLabelOptions = {}) {
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

	const trenchEnabled = labelOptions.enabled || false;
	const conduitEnabled = conduitLabelOptions.enabled || false;

	// If no labels are enabled, return static style
	if (!trenchEnabled && !conduitEnabled) {
		return geometryStyle;
	}

	const trenchField = labelOptions.field || 'id_trench';
	const trenchMinRes = labelOptions.minResolution || 1.5;
	const trenchTextStyle = labelOptions.textStyle || {};

	const conduitField = conduitLabelOptions.field || 'conduit_names';
	const conduitMinRes = conduitLabelOptions.minResolution || 1.5;
	const conduitTextStyle = conduitLabelOptions.textStyle || {};

	return function (feature, resolution) {
		const styles = [geometryStyle];

		if (trenchEnabled && resolution < trenchMinRes) {
			const labelText = (feature.get(trenchField) || '').toString();
			if (labelText) {
				styles.push(
					new Style({
						text: createTextStyle({ text: labelText, ...trenchTextStyle }),
						declutterMode: 'declutter'
					})
				);
			}
		}

		if (conduitEnabled && resolution < conduitMinRes) {
			const conduitText = (feature.get(conduitField) || '').toString();
			if (conduitText) {
				styles.push(
					new Style({
						text: createTextStyle({
							text: conduitText,
							offsetY: 30,
							...conduitTextStyle
						}),
						declutterMode: 'declutter'
					})
				);
			}
		}

		return styles.length === 1 ? geometryStyle : styles;
	};
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
 * Default area style configuration
 */
export const DEFAULT_AREA_COLOR = '#22c55e';
export const DEFAULT_AREA_OPACITY = 0.3;

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

		let geometryStyle = geometryStyleCache.get(geometryCacheKey);
		if (!geometryStyle) {
			geometryStyle = new Style({
				image: new CircleStyle({
					radius: typeConfig.size || DEFAULT_NODE_SIZE,
					fill: new Fill({ color: typeConfig.color || DEFAULT_NODE_COLOR }),
					stroke: new Stroke({ color: '#000000', width: 1 })
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

/**
 * Creates a style for highlighting linked trenches
 * Uses a dashed stroke to differentiate from solid selection
 * @param {string} color - The color for the linked trench style (default: skeleton secondary-500)
 * @returns {Style}
 */
export function createLinkedTrenchStyle(color = '#06b6d4') {
	return new Style({
		stroke: new Stroke({
			color: color,
			width: 5,
			lineDash: [8, 4]
		})
	});
}

/**
 * Creates a style function for trench features with per-attribute styling
 * @param {Object} attributeStyles - Object mapping attribute values to style config
 *   { [attribute_value]: { color: '#hex', visible: boolean } }
 * @param {string} styleMode - 'surface' | 'construction_type' | 'none'
 * @param {string} fallbackColor - Color to use when styleMode is 'none' or attribute not found
 * @param {Object} labelOptions - Trench label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show trench labels
 * @param {string} [labelOptions.field='id_trench'] - Feature property to use for trench label
 * @param {number} [labelOptions.minResolution=1.5] - Minimum resolution to show trench labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options for trench labels
 * @param {Object} [conduitLabelOptions={}] - Conduit label configuration options
 * @param {boolean} [conduitLabelOptions.enabled=false] - Whether to show conduit labels
 * @param {string} [conduitLabelOptions.field='conduit_names'] - Feature property to use for conduit label
 * @param {number} [conduitLabelOptions.minResolution=1.5] - Minimum resolution to show conduit labels
 * @param {Object} [conduitLabelOptions.textStyle] - Custom text style options for conduit labels
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createTrenchStyleByAttribute(
	attributeStyles = {},
	styleMode = 'none',
	fallbackColor = DEFAULT_TRENCH_COLOR,
	labelOptions = {},
	conduitLabelOptions = {}
) {
	const trenchEnabled = labelOptions.enabled || false;
	const trenchField = labelOptions.field || 'id_trench';
	const trenchMinRes = labelOptions.minResolution || 1.5;
	const trenchTextStyle = labelOptions.textStyle || {};

	const conduitEnabled = conduitLabelOptions.enabled || false;
	const conduitField = conduitLabelOptions.field || 'conduit_names';
	const conduitMinRes = conduitLabelOptions.minResolution || 1.5;
	const conduitTextStyle = conduitLabelOptions.textStyle || {};

	const geometryStyleCache = new Map();

	return function (feature, resolution) {
		let color = fallbackColor;
		let visible = true;

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

		if (!visible) {
			return null;
		}

		const geometryCacheKey = `${styleMode}_${color}`;

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

		const styles = [geometryStyle];

		if (trenchEnabled && resolution < trenchMinRes) {
			const labelText = (feature.get(trenchField) || '').toString();
			if (labelText) {
				styles.push(
					new Style({
						text: createTextStyle({ text: labelText, ...trenchTextStyle }),
						declutterMode: 'declutter'
					})
				);
			}
		}

		if (conduitEnabled && resolution < conduitMinRes) {
			const conduitText = (feature.get(conduitField) || '').toString();
			if (conduitText) {
				styles.push(
					new Style({
						text: createTextStyle({
							text: conduitText,
							offsetY: 30, // Offset below trench label
							...conduitTextStyle
						}),
						declutterMode: 'declutter'
					})
				);
			}
		}

		return styles.length === 1 ? geometryStyle : styles;
	};
}

/**
 * Creates a style for area polygons
 * @param {string} color - The fill color for the area
 * @param {number} [opacity=DEFAULT_AREA_OPACITY] - Fill opacity (0-1)
 * @returns {Style}
 */
export function createAreaStyle(color, opacity = DEFAULT_AREA_OPACITY) {
	const fillColor = hexToRgba(color, opacity);

	return new Style({
		fill: new Fill({
			color: fillColor
		}),
		stroke: new Stroke({
			color: color,
			width: 2
		})
	});
}

/**
 * Creates a style function for area polygons with optional labels
 * @param {string} color - The fill color for the area
 * @param {number} [opacity=DEFAULT_AREA_OPACITY] - Fill opacity (0-1)
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=5.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createAreaStyleWithLabels(
	color = DEFAULT_AREA_COLOR,
	opacity = DEFAULT_AREA_OPACITY,
	labelOptions = {}
) {
	const { enabled = false, field = 'name', minResolution = 5.0, textStyle = {} } = labelOptions;

	const fillColor = hexToRgba(color, opacity);

	const geometryStyle = new Style({
		fill: new Fill({
			color: fillColor
		}),
		stroke: new Stroke({
			color: color,
			width: 2
		}),
		declutterMode: 'none'
	});

	return function (feature, resolution) {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, offsetX: 0, offsetY: 0, ...textStyle }),
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates a style function for area polygons with per-type styling
 * @param {Object} areaTypeStyles - Object mapping area type IDs to style config
 *   { [area_type_id]: { color: '#hex', visible: boolean } }
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=5.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {Function} Style function that accepts (feature, resolution)
 */
export function createAreaStyleByType(areaTypeStyles = {}, labelOptions = {}) {
	const { enabled = false, field = 'name', minResolution = 5.0, textStyle = {} } = labelOptions;

	const geometryStyleCache = new Map();

	return function (feature, resolution) {
		const areaType = feature.get('area_type');
		const typeConfig = areaTypeStyles[areaType] || {
			color: DEFAULT_AREA_COLOR,
			visible: true
		};

		if (!typeConfig.visible) {
			return null;
		}

		const geometryCacheKey = `${areaType || 'default'}_${typeConfig.color}`;

		let geometryStyle = geometryStyleCache.get(geometryCacheKey);
		if (!geometryStyle) {
			const fillColor = hexToRgba(typeConfig.color || DEFAULT_AREA_COLOR, DEFAULT_AREA_OPACITY);
			geometryStyle = new Style({
				fill: new Fill({
					color: fillColor
				}),
				stroke: new Stroke({
					color: typeConfig.color || DEFAULT_AREA_COLOR,
					width: 2
				}),
				declutterMode: 'none'
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const showLabels = enabled && resolution < minResolution;

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, offsetX: 0, offsetY: 0, ...textStyle }),
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Helper function to convert hex color to rgba
 * @param {string} hex - Hex color code (e.g., '#ff0000')
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, alpha) {
	hex = hex.replace('#', '');

	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
