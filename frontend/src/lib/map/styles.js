import { Circle as CircleStyle, RegularShape, Style } from 'ol/style';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Text from 'ol/style/Text.js';

import {
	DEFAULT_ADDRESS_COLOR,
	DEFAULT_ADDRESS_SIZE,
	DEFAULT_AREA_COLOR,
	DEFAULT_AREA_OPACITY,
	DEFAULT_NODE_COLOR,
	DEFAULT_NODE_SHAPE,
	DEFAULT_NODE_SIZE,
	DEFAULT_TRENCH_COLOR,
	DEFAULT_TRENCH_WIDTH,
	getNodeTypeDefault
} from './defaultColors.js';

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
 * @returns {import('ol/style/Style').StyleLike} Style or style function that accepts (feature, resolution)
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
		// @ts-ignore
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

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		const styles = [geometryStyle];

		if (trenchEnabled && resolution < trenchMinRes) {
			const labelText = (feature.get(trenchField) || '').toString();
			if (labelText) {
				styles.push(
					new Style({
						text: createTextStyle({ text: labelText, ...trenchTextStyle }),
						// @ts-ignore
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
						// @ts-ignore
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
		textAlign: /** @type {CanvasTextAlign} */ (textAlign)
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
 * @returns {import('ol/style/Style').StyleFunction} Style function that accepts (feature, resolution)
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
		// @ts-ignore
		declutterMode: 'none'
	});

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				// @ts-ignore
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
 * @param {'circle' | 'square'} [shape='square'] - Shape for point features
 * @param {number} [size=7] - Size for point features
 * @returns {Style}
 */
export function createSelectedStyle(color, shape = DEFAULT_NODE_SHAPE, size = 7) {
	return new Style({
		fill: new Fill({
			color: color
		}),
		stroke: new Stroke({
			color: color,
			width: 3
		}),
		image: createNodeImage(shape, size, color, color, 2)
	});
}

/**
 * Creates a style for address points
 * @returns {Style}
 */
export function createAddressStyle() {
	return new Style({
		image: new CircleStyle({
			radius: DEFAULT_ADDRESS_SIZE,
			fill: new Fill({ color: DEFAULT_ADDRESS_COLOR }),
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
 * @returns {import('ol/style/Style').StyleFunction} Style function that accepts (feature, resolution)
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
		// @ts-ignore
		declutterMode: 'none'
	});

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
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
				// @ts-ignore
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates an image style for a node point based on shape
 * @param {'circle' | 'square'} shape
 * @param {number} size
 * @param {string} fillColor
 * @param {string} [strokeColor='#000000']
 * @param {number} [strokeWidth=1]
 * @returns {CircleStyle | RegularShape}
 */
export function createNodeImage(shape, size, fillColor, strokeColor = '#000000', strokeWidth = 1) {
	const fill = new Fill({ color: fillColor });
	const stroke = new Stroke({ color: strokeColor, width: strokeWidth });

	if (shape === 'circle') {
		return new CircleStyle({ radius: size, fill, stroke });
	}
	return new RegularShape({
		fill,
		stroke,
		points: 4,
		radius: size,
		angle: Math.PI / 4
	});
}

/**
 * Creates a style for node points
 * @returns {Style}
 */
export function createNodeStyle() {
	return new Style({
		image: createNodeImage(DEFAULT_NODE_SHAPE, DEFAULT_NODE_SIZE, DEFAULT_NODE_COLOR)
	});
}

/**
 * Creates a style function for node points with optional labels
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels (more zoomed in)
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {import('ol/style/Style').StyleFunction} Style function that accepts (feature, resolution)
 */
export function createNodeStyleWithLabels(labelOptions = {}) {
	const { enabled = false, field = 'name', minResolution = 1.0, textStyle = {} } = labelOptions;

	const geometryStyle = new Style({
		image: createNodeImage(DEFAULT_NODE_SHAPE, DEFAULT_NODE_SIZE, DEFAULT_NODE_COLOR),
		// @ts-ignore
		declutterMode: 'none'
	});

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				// @ts-ignore
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

export {
	DEFAULT_ADDRESS_COLOR,
	DEFAULT_ADDRESS_SIZE,
	DEFAULT_AREA_COLOR,
	DEFAULT_NODE_SHAPE,
	DEFAULT_SELECTED_COLOR,
	DEFAULT_TRENCH_COLOR,
	getNodeTypeDefault
} from './defaultColors.js';

/**
 * Creates a style function for node points with per-type styling
 * @param {Record<string, {color?: string, size?: number, visible?: boolean, shape?: 'circle' | 'square'}>} nodeTypeStyles - Object mapping node type names to style config
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=1.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {import('ol/style/Style').StyleFunction} Style function that accepts (feature, resolution)
 */
export function createNodeStyleByType(nodeTypeStyles = {}, labelOptions = {}) {
	const { enabled = false, field = 'name', minResolution = 1.0, textStyle = {} } = labelOptions;

	/** @type {Map<string, Style>} */
	const geometryStyleCache = new Map();

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		const nodeType = /** @type {string} */ (feature.get('node_type'));
		const defaults = getNodeTypeDefault(nodeType);
		const typeConfig = nodeTypeStyles[nodeType] || {
			color: defaults.color,
			size: defaults.size,
			visible: true,
			shape: defaults.shape
		};

		if (!typeConfig.visible) {
			return undefined;
		}

		const shape = typeConfig.shape || defaults.shape;
		const geometryCacheKey = `${nodeType || 'default'}_${typeConfig.color}_${typeConfig.size}_${shape}`;

		let geometryStyle = geometryStyleCache.get(geometryCacheKey);
		if (!geometryStyle) {
			geometryStyle = new Style({
				image: createNodeImage(
					shape,
					typeConfig.size || DEFAULT_NODE_SIZE,
					typeConfig.color || DEFAULT_NODE_COLOR
				),
				// @ts-ignore
				declutterMode: 'none'
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const showLabels = enabled && resolution < minResolution;

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle }),
				// @ts-ignore
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
 * @param {Record<string, {color?: string, visible?: boolean}>} attributeStyles - Object mapping attribute values to style config
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
 * @returns {import('ol/style/Style').StyleFunction} Style function that accepts (feature, resolution)
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

	/** @type {Map<string, Style>} */
	const geometryStyleCache = new Map();

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		let color = fallbackColor;
		let visible = true;

		if (styleMode === 'surface') {
			const surfaceValue = /** @type {string} */ (feature.get('surface'));
			const config = attributeStyles[surfaceValue];
			if (config) {
				color = config.color || fallbackColor;
				visible = config.visible !== false;
			}
		} else if (styleMode === 'construction_type') {
			const constructionTypeValue = /** @type {string} */ (feature.get('construction_type'));
			const config = attributeStyles[constructionTypeValue];
			if (config) {
				color = config.color || fallbackColor;
				visible = config.visible !== false;
			}
		}

		if (!visible) {
			return undefined;
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
				// @ts-ignore
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
						// @ts-ignore
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
						// @ts-ignore
						declutterMode: 'declutter'
					})
				);
			}
		}

		return styles.length === 1 ? geometryStyle : styles;
	};
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
 * @returns {import('ol/style/Style').StyleFunction} Style function that accepts (feature, resolution)
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
		// @ts-ignore
		declutterMode: 'none'
	});

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, offsetX: 0, offsetY: 0, ...textStyle }),
				// @ts-ignore
				declutterMode: 'declutter'
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates a style function for area polygons with per-type styling
 * @param {Record<string, {color?: string, visible?: boolean}>} areaTypeStyles - Object mapping area type IDs to style config
 * @param {Object} labelOptions - Label configuration options
 * @param {boolean} [labelOptions.enabled=false] - Whether to show labels
 * @param {string} [labelOptions.field='name'] - Feature property to use for label
 * @param {number} [labelOptions.minResolution=5.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {import('ol/style/Style').StyleFunction} Style function that accepts (feature, resolution)
 */
export function createAreaStyleByType(areaTypeStyles = {}, labelOptions = {}) {
	const { enabled = false, field = 'name', minResolution = 5.0, textStyle = {} } = labelOptions;

	/** @type {Map<string, Style>} */
	const geometryStyleCache = new Map();

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		const areaType = /** @type {string} */ (feature.get('area_type'));
		const typeConfig = areaTypeStyles[areaType] || {
			color: DEFAULT_AREA_COLOR,
			visible: true
		};

		if (!typeConfig.visible) {
			return undefined;
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
				// @ts-ignore
				declutterMode: 'none'
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const showLabels = enabled && resolution < minResolution;

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, offsetX: 0, offsetY: 0, ...textStyle }),
				// @ts-ignore
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

/**
 * Creates a style for the damage point marker
 * @returns {Style}
 */
export function createDamagePointStyle() {
	return new Style({
		image: new CircleStyle({
			radius: 10,
			fill: new Fill({ color: 'rgba(220, 38, 38, 0.9)' }),
			stroke: new Stroke({ color: '#ffffff', width: 3 })
		})
	});
}

/**
 * Creates a style for affected trenches in fault simulation
 * @returns {Style}
 */
export function createAffectedTrenchStyle() {
	return new Style({
		stroke: new Stroke({ color: 'rgba(220, 38, 38, 0.8)', width: 5 })
	});
}

/**
 * Creates a style for affected nodes in fault simulation
 * @param {'default'|'address'} [variant='default'] - Node variant
 * @returns {Style}
 */
export function createAffectedNodeStyle(variant = 'default') {
	const color = variant === 'address' ? 'rgba(147, 51, 234, 0.9)' : 'rgba(234, 88, 12, 0.9)';
	return new Style({
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color }),
			stroke: new Stroke({ color: '#ffffff', width: 2 })
		})
	});
}

/**
 * Creates a style for affected addresses in fault simulation
 * @returns {Style}
 */
export function createAffectedAddressStyle() {
	return new Style({
		image: new CircleStyle({
			radius: 8,
			fill: new Fill({ color: 'rgba(147, 51, 234, 0.9)' }),
			stroke: new Stroke({ color: '#ffffff', width: 2 })
		})
	});
}

/**
 * Creates a style for route overlays
 * @param {string} [color='rgba(255, 0, 0, 0.7)'] - Stroke color
 * @param {number} [width=4] - Stroke width
 * @returns {Style}
 */
export function createRouteStyle(color = 'rgba(255, 0, 0, 0.7)', width = 4) {
	return new Style({
		stroke: new Stroke({ color, width })
	});
}

/**
 * Creates a style for feature highlight overlays
 * @param {string} [color='rgba(255, 0, 255, 0.7)'] - Highlight color
 * @param {'circle' | 'square'} [shape='square'] - Shape for point features
 * @returns {Style}
 */
export function createHighlightStyle(color = 'rgba(255, 0, 255, 0.7)', shape = DEFAULT_NODE_SHAPE) {
	return new Style({
		stroke: new Stroke({ color, width: 8 }),
		image: createNodeImage(shape, 9, 'transparent', color, 4)
	});
}

// --- Measurement style ---

/**
 * Creates a style for map measurement interactions
 * @returns {Style}
 */
export function createMeasureStyle() {
	return new Style({
		fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
		stroke: new Stroke({ color: '#ffcc33', width: 2 }),
		image: new CircleStyle({
			radius: 5,
			stroke: new Stroke({ color: '#ffcc33' }),
			fill: new Fill({ color: '#ffcc33' })
		})
	});
}

/**
 * Creates a style for search result highlighting
 * @param {string} [color='#ff0000'] - Base highlight color (hex)
 * @param {'circle' | 'square'} [shape='square'] - Shape for point features
 * @returns {Style}
 */
export function createSearchHighlightStyle(color = '#ff0000', shape = DEFAULT_NODE_SHAPE) {
	return new Style({
		stroke: new Stroke({
			color: color,
			width: 4,
			lineDash: [10, 10]
		}),
		fill: new Fill({
			color: color + '40'
		}),
		image: createNodeImage(shape, 8, color + '80', color, 3)
	});
}

/** @type {Record<string, string>} */
export const TRACE_MARKER_COLORS = {
	entry_point: '#6366f1',
	node: '#22c55e',
	address: '#ef4444',
	residential_unit: '#8b5cf6'
};

export const TRACE_DARK_COLOR = '#9ca3af';
export const TRACE_BREAK_COLOR = '#ef4444';
export const TRACE_SELECTED_COLOR = '#3b82f6';
export const TRACE_DEFAULT_CABLE_COLOR = '#f59e0b';

const INQUIRY_COLOR = '#3b82f6';
const INQUIRY_HIGHLIGHT_COLOR = '#f59e0b';

/**
 * Creates a style for inquiry polygon areas
 * @returns {Style}
 */
export function createInquiryPolygonStyle() {
	return new Style({
		fill: new Fill({ color: 'rgba(59, 130, 246, 0.15)' }),
		stroke: new Stroke({ color: INQUIRY_COLOR, width: 2 })
	});
}

/**
 * Creates a style for the active drawing interaction on inquiry polygons
 * @returns {Style}
 */
export function createInquiryDrawingStyle() {
	return new Style({
		fill: new Fill({ color: 'rgba(59, 130, 246, 0.1)' }),
		stroke: new Stroke({ color: INQUIRY_COLOR, width: 2, lineDash: [6, 4] })
	});
}

/**
 * Creates a style for highlighted features intersecting inquiry polygons
 * @returns {Style}
 */
export function createInquiryHighlightStyle() {
	return new Style({
		fill: new Fill({ color: 'rgba(251, 191, 36, 0.4)' }),
		stroke: new Stroke({ color: INQUIRY_HIGHLIGHT_COLOR, width: 3 })
	});
}

/**
 * Creates a style for highlighted point features intersecting inquiry polygons
 * @returns {Style}
 */
export function createInquiryHighlightPointStyle() {
	return new Style({
		image: new CircleStyle({
			radius: 6,
			fill: new Fill({ color: 'rgba(251, 191, 36, 0.6)' }),
			stroke: new Stroke({ color: INQUIRY_HIGHLIGHT_COLOR, width: 2 })
		})
	});
}

/**
 * Creates a style function for inquiry polygons with name labels
 * @param {Object} [labelOptions={}] - Label configuration options
 * @param {number} [labelOptions.minResolution=5.0] - Minimum resolution to show labels
 * @param {Object} [labelOptions.textStyle] - Custom text style options
 * @returns {import('ol/style/Style').StyleFunction}
 */
export function createInquiryPolygonStyleWithLabels(labelOptions = {}) {
	const { minResolution = 5.0, textStyle = {} } = labelOptions;

	const geometryStyle = createInquiryPolygonStyle();

	/**
	 * @param {import('ol/Feature').FeatureLike} feature
	 * @param {number} resolution
	 */
	return function (feature, resolution) {
		const name = feature.get('name');
		if (!name || resolution >= minResolution) return geometryStyle;

		const labelStyle = new Style({
			text: createTextStyle({
				text: String(name),
				offsetX: 0,
				offsetY: 0,
				font: '13px Calibri,sans-serif',
				fillColor: '#1e40af',
				strokeColor: '#ffffff',
				strokeWidth: 3,
				...textStyle
			})
		});

		return [geometryStyle, labelStyle];
	};
}
