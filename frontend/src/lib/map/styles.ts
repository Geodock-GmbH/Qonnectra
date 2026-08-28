import type { FeatureLike } from 'ol/Feature';
import type { StyleFunction, StyleLike } from 'ol/style/Style';
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
} from './defaultColors';

export interface LabelOptions {
	enabled?: boolean;
	field?: string;
	minResolution?: number;
	textStyle?: Partial<TextStyleOptions>;
}

export interface TextStyleOptions {
	text: string;
	font?: string;
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	offsetX?: number;
	offsetY?: number;
	textAlign?: string;
}

export type NodeShape = 'circle' | 'square';

export type NodeTypeStyles = Record<
	string,
	{ color?: string; size?: number; visible?: boolean; shape?: NodeShape }
>;

export type AreaTypeStyles = Record<string, { color?: string; visible?: boolean }>;

export type AttributeStyles = Record<string, { color?: string; visible?: boolean }>;

/**
 * Creates a style function for trench features with optional trench and conduit labels
 */
export function createTrenchStyle(
	color: string,
	labelOptions: LabelOptions = {},
	conduitLabelOptions: LabelOptions = {}
): StyleLike {
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
		})
	});

	const trenchEnabled = labelOptions.enabled || false;
	const conduitEnabled = conduitLabelOptions.enabled || false;

	if (!trenchEnabled && !conduitEnabled) {
		return geometryStyle;
	}

	const trenchField = labelOptions.field || 'id_trench';
	const trenchMinRes = labelOptions.minResolution || 1.5;
	const trenchTextStyle = labelOptions.textStyle || {};

	const conduitField = conduitLabelOptions.field || 'conduit_names';
	const conduitMinRes = conduitLabelOptions.minResolution || 1.5;
	const conduitTextStyle = conduitLabelOptions.textStyle || {};

	return function (feature: FeatureLike, resolution: number): Style | Style[] {
		const styles = [geometryStyle];

		if (trenchEnabled && resolution < trenchMinRes) {
			const labelText = (feature.get(trenchField) || '').toString();
			if (labelText) {
				styles.push(
					new Style({
						text: createTextStyle({ text: labelText, ...trenchTextStyle })
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
						})
					})
				);
			}
		}

		return styles.length === 1 ? geometryStyle : styles;
	};
}

/**
 * Creates a text style with customizable options
 */
export function createTextStyle(options: TextStyleOptions): Text {
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
		textAlign: textAlign as CanvasTextAlign
	});
}

/**
 * Creates a style function for trench features with optional labels
 */
export function createTrenchStyleWithLabels(
	color: string,
	labelOptions: LabelOptions = {}
): StyleFunction {
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
		})
	});

	return function (feature: FeatureLike, resolution: number): Style | Style[] {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle })
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates a style for selected features
 */
export function createSelectedStyle(
	color: string,
	shape: NodeShape = DEFAULT_NODE_SHAPE,
	size = 7
): Style {
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
 */
export function createAddressStyle(): Style {
	return new Style({
		image: new CircleStyle({
			radius: DEFAULT_ADDRESS_SIZE,
			fill: new Fill({ color: DEFAULT_ADDRESS_COLOR }),
			stroke: new Stroke({ color: '#000000', width: 1 })
		})
	});
}

/**
 * Creates a style function for address points with optional labels.
 * Labels display: street + house_number + house_number_suffix (if present)
 */
export function createAddressStyleWithLabels(
	color = DEFAULT_ADDRESS_COLOR,
	size = DEFAULT_ADDRESS_SIZE,
	labelOptions: LabelOptions = {}
): StyleFunction {
	const { enabled = false, minResolution = 1.0, textStyle = {} } = labelOptions;

	const geometryStyle = new Style({
		image: new CircleStyle({
			radius: size,
			fill: new Fill({ color: color }),
			stroke: new Stroke({ color: '#000000', width: 1 })
		})
	});

	return function (feature: FeatureLike, resolution: number): Style | Style[] {
		if (enabled && resolution < minResolution) {
			const street = feature.get('street') || '';
			const houseNumber = feature.get('housenumber') || '';
			const suffix = feature.get('house_number_suffix');
			const postalCode = feature.get('zip_code') || '';
			const city = feature.get('city') || '';
			const labelText = `${street} ${houseNumber}${suffix || ''}, ${postalCode} ${city}`.trim();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle })
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates an image style for a node point based on shape
 */
export function createNodeImage(
	shape: NodeShape,
	size: number,
	fillColor: string,
	strokeColor = '#000000',
	strokeWidth = 1
): CircleStyle | RegularShape {
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
 */
export function createNodeStyle(): Style {
	return new Style({
		image: createNodeImage(DEFAULT_NODE_SHAPE, DEFAULT_NODE_SIZE, DEFAULT_NODE_COLOR)
	});
}

/**
 * Creates a style function for node points with optional labels
 */
export function createNodeStyleWithLabels(labelOptions: LabelOptions = {}): StyleFunction {
	const { enabled = false, field = 'name', minResolution = 1.0, textStyle = {} } = labelOptions;

	const geometryStyle = new Style({
		image: createNodeImage(DEFAULT_NODE_SHAPE, DEFAULT_NODE_SIZE, DEFAULT_NODE_COLOR)
	});

	return function (feature: FeatureLike, resolution: number): Style | Style[] {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle })
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
} from './defaultColors';

/**
 * Creates a style function for node points with per-type styling
 */
export function createNodeStyleByType(
	nodeTypeStyles: NodeTypeStyles = {},
	labelOptions: LabelOptions = {}
): StyleFunction {
	const { enabled = false, field = 'name', minResolution = 1.0, textStyle = {} } = labelOptions;

	const geometryStyleCache = new Map<string, Style>();

	return function (feature: FeatureLike, resolution: number): Style | Style[] | void {
		const nodeType = feature.get('node_type') as string;
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
				)
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const showLabels = enabled && resolution < minResolution;

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, ...textStyle })
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates a style for highlighting linked trenches.
 * Uses a dashed stroke to differentiate from solid selection.
 */
export function createLinkedTrenchStyle(color = '#06b6d4'): Style {
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
 */
export function createTrenchStyleByAttribute(
	attributeStyles: AttributeStyles = {},
	styleMode: 'surface' | 'construction_type' | 'none' = 'none',
	fallbackColor = DEFAULT_TRENCH_COLOR,
	labelOptions: LabelOptions = {},
	conduitLabelOptions: LabelOptions = {}
): StyleFunction {
	const trenchEnabled = labelOptions.enabled || false;
	const trenchField = labelOptions.field || 'id_trench';
	const trenchMinRes = labelOptions.minResolution || 1.5;
	const trenchTextStyle = labelOptions.textStyle || {};

	const conduitEnabled = conduitLabelOptions.enabled || false;
	const conduitField = conduitLabelOptions.field || 'conduit_names';
	const conduitMinRes = conduitLabelOptions.minResolution || 1.5;
	const conduitTextStyle = conduitLabelOptions.textStyle || {};

	const geometryStyleCache = new Map<string, Style>();

	return function (feature: FeatureLike, resolution: number): Style | Style[] | void {
		let color = fallbackColor;
		let visible = true;

		if (styleMode === 'surface') {
			const surfaceValue = feature.get('surface') as string;
			const config = attributeStyles[surfaceValue];
			if (config) {
				color = config.color || fallbackColor;
				visible = config.visible !== false;
			}
		} else if (styleMode === 'construction_type') {
			const constructionTypeValue = feature.get('construction_type') as string;
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
				})
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const styles = [geometryStyle];

		if (trenchEnabled && resolution < trenchMinRes) {
			const labelText = (feature.get(trenchField) || '').toString();
			if (labelText) {
				styles.push(
					new Style({
						text: createTextStyle({ text: labelText, ...trenchTextStyle })
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
						})
					})
				);
			}
		}

		return styles.length === 1 ? geometryStyle : styles;
	};
}

/**
 * Creates a style function for area polygons with optional labels
 */
export function createAreaStyleWithLabels(
	color = DEFAULT_AREA_COLOR,
	opacity = DEFAULT_AREA_OPACITY,
	labelOptions: LabelOptions = {}
): StyleFunction {
	const { enabled = false, field = 'name', minResolution = 5.0, textStyle = {} } = labelOptions;

	const fillColor = hexToRgba(color, opacity);

	const geometryStyle = new Style({
		fill: new Fill({
			color: fillColor
		}),
		stroke: new Stroke({
			color: color,
			width: 2
		})
	});

	return function (feature: FeatureLike, resolution: number): Style | Style[] {
		if (enabled && resolution < minResolution) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, offsetX: 0, offsetY: 0, ...textStyle })
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Creates a style function for area polygons with per-type styling
 */
export function createAreaStyleByType(
	areaTypeStyles: AreaTypeStyles = {},
	labelOptions: LabelOptions = {}
): StyleFunction {
	const { enabled = false, field = 'name', minResolution = 5.0, textStyle = {} } = labelOptions;

	const geometryStyleCache = new Map<string, Style>();

	return function (feature: FeatureLike, resolution: number): Style | Style[] | void {
		const areaType = feature.get('area_type') as string;
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
				})
			});
			geometryStyleCache.set(geometryCacheKey, geometryStyle);
		}

		const showLabels = enabled && resolution < minResolution;

		if (showLabels) {
			const labelText = (feature.get(field) || '').toString();
			const labelStyle = new Style({
				text: createTextStyle({ text: labelText, offsetX: 0, offsetY: 0, ...textStyle })
			});
			return [geometryStyle, labelStyle];
		}

		return geometryStyle;
	};
}

/**
 * Helper function to convert hex color to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
	hex = hex.replace('#', '');

	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Creates a style for the damage point marker
 */
export function createDamagePointStyle(): Style {
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
 */
export function createAffectedTrenchStyle(): Style {
	return new Style({
		stroke: new Stroke({ color: 'rgba(220, 38, 38, 0.8)', width: 5 })
	});
}

/**
 * Creates a style for affected nodes in fault simulation
 */
export function createAffectedNodeStyle(variant: 'default' | 'address' = 'default'): Style {
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
 */
export function createAffectedAddressStyle(): Style {
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
 */
export function createRouteStyle(color = 'rgba(255, 0, 0, 0.7)', width = 4): Style {
	return new Style({
		stroke: new Stroke({ color, width })
	});
}

/**
 * Creates a style for feature highlight overlays
 */
export function createHighlightStyle(
	color = 'rgba(255, 0, 255, 0.7)',
	shape: NodeShape = DEFAULT_NODE_SHAPE
): Style {
	return new Style({
		stroke: new Stroke({ color, width: 8 }),
		image: createNodeImage(shape, 9, 'transparent', color, 4)
	});
}

// --- Measurement style ---

/**
 * Creates a style for map measurement interactions
 */
export function createMeasureStyle(): Style {
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
 */
export function createSearchHighlightStyle(
	color = '#ff0000',
	shape: NodeShape = DEFAULT_NODE_SHAPE
): Style {
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

export const TRACE_MARKER_COLORS: Record<string, string> = {
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
 */
export function createInquiryPolygonStyle(): Style {
	return new Style({
		fill: new Fill({ color: 'rgba(59, 130, 246, 0.15)' }),
		stroke: new Stroke({ color: INQUIRY_COLOR, width: 2 })
	});
}

/**
 * Creates a style for the active drawing interaction on inquiry polygons
 */
export function createInquiryDrawingStyle(): Style {
	return new Style({
		fill: new Fill({ color: 'rgba(59, 130, 246, 0.1)' }),
		stroke: new Stroke({ color: INQUIRY_COLOR, width: 2, lineDash: [6, 4] })
	});
}

/**
 * Creates a style for highlighted features intersecting inquiry polygons
 */
export function createInquiryHighlightStyle(): Style {
	return new Style({
		fill: new Fill({ color: 'rgba(251, 191, 36, 0.4)' }),
		stroke: new Stroke({ color: INQUIRY_HIGHLIGHT_COLOR, width: 3 })
	});
}

/**
 * Creates a style for highlighted point features intersecting inquiry polygons
 */
export function createInquiryHighlightPointStyle(): Style {
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
 */
export function createInquiryPolygonStyleWithLabels(
	labelOptions: { minResolution?: number; textStyle?: Partial<TextStyleOptions> } = {}
): StyleFunction {
	const { minResolution = 5.0, textStyle = {} } = labelOptions;

	const geometryStyle = createInquiryPolygonStyle();

	return function (feature: FeatureLike, resolution: number): Style | Style[] {
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
