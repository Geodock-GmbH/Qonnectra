import type { FeatureLike } from 'ol/Feature';
import type { StyleFunction } from 'ol/style/Style';
import { Circle as CircleStyle, RegularShape, Style } from 'ol/style';
import { describe, expect, test } from 'vitest';

import {
	createAddressStyle,
	createAddressStyleWithLabels,
	createAffectedNodeStyle,
	createAffectedTrenchStyle,
	createAreaStyleByType,
	createAreaStyleWithLabels,
	createDamagePointStyle,
	createHighlightStyle,
	createInquiryPolygonStyleWithLabels,
	createLinkedTrenchStyle,
	createMeasureStyle,
	createNodeImage,
	createNodeStyle,
	createNodeStyleByType,
	createNodeStyleWithLabels,
	createRouteStyle,
	createSearchHighlightStyle,
	createSelectedStyle,
	createTextStyle,
	createTrenchStyle,
	createTrenchStyleByAttribute,
	createTrenchStyleWithLabels
} from './styles';

function makeFeature(properties: Record<string, unknown>): FeatureLike {
	return { get: (key: string) => properties[key] } as unknown as FeatureLike;
}

function asStyles(result: Style | Style[] | void): Style[] {
	if (!result) return [];
	return Array.isArray(result) ? result : [result];
}

describe('createTextStyle', () => {
	test('should apply defaults', () => {
		const text = createTextStyle({ text: 'Label' });

		expect(text.getText()).toBe('Label');
		expect(text.getFont()).toBe('12px Calibri,sans-serif');
		expect(text.getFill()?.getColor()).toBe('#000');
		expect(text.getStroke()?.getColor()).toBe('#fff');
		expect(text.getStroke()?.getWidth()).toBe(3);
		expect(text.getOffsetX()).toBe(15);
		expect(text.getOffsetY()).toBe(15);
	});

	test('should apply overrides', () => {
		const text = createTextStyle({
			text: 'Custom',
			fillColor: '#ff0000',
			offsetX: 0,
			offsetY: 30
		});

		expect(text.getFill()?.getColor()).toBe('#ff0000');
		expect(text.getOffsetX()).toBe(0);
		expect(text.getOffsetY()).toBe(30);
	});
});

describe('createTrenchStyle', () => {
	test('should return a plain style when labels are disabled', () => {
		const style = createTrenchStyle('#0033ff');

		expect(style).toBeInstanceOf(Style);
		expect((style as Style).getStroke()?.getColor()).toBe('#0033ff');
	});

	test('should add trench and conduit labels below the min resolution', () => {
		const styleFn = createTrenchStyle(
			'#0033ff',
			{ enabled: true },
			{ enabled: true }
		) as StyleFunction;
		const feature = makeFeature({ id_trench: 'T-1', conduit_names: 'C-1, C-2' });

		const styles = asStyles(styleFn(feature, 1.0) as Style[]);

		expect(styles).toHaveLength(3);
		expect(styles[1].getText()?.getText()).toBe('T-1');
		expect(styles[2].getText()?.getText()).toBe('C-1, C-2');
		expect(styles[2].getText()?.getOffsetY()).toBe(30);
	});

	test('should return only the geometry style above the min resolution', () => {
		const styleFn = createTrenchStyle('#0033ff', { enabled: true }) as StyleFunction;
		const feature = makeFeature({ id_trench: 'T-1' });

		const result = styleFn(feature, 5.0);

		expect(result).toBeInstanceOf(Style);
	});

	test('should skip labels for features without label text', () => {
		const styleFn = createTrenchStyle('#0033ff', { enabled: true }) as StyleFunction;

		const result = styleFn(makeFeature({}), 1.0);

		expect(result).toBeInstanceOf(Style);
	});
});

describe('createTrenchStyleWithLabels', () => {
	test('should return geometry and label styles below the min resolution', () => {
		const styleFn = createTrenchStyleWithLabels('#0033ff', { enabled: true });
		const feature = makeFeature({ id_trench: 'T-9' });

		const styles = asStyles(styleFn(feature, 1.0));

		expect(styles).toHaveLength(2);
		expect(styles[1].getText()?.getText()).toBe('T-9');
	});

	test('should return only the geometry style when labels are disabled', () => {
		const styleFn = createTrenchStyleWithLabels('#0033ff');

		expect(styleFn(makeFeature({}), 1.0)).toBeInstanceOf(Style);
	});
});

describe('createNodeImage', () => {
	test('should create a circle image for the circle shape', () => {
		const image = createNodeImage('circle', 8, '#ff0000');

		expect(image).toBeInstanceOf(CircleStyle);
		expect((image as CircleStyle).getRadius()).toBe(8);
	});

	test('should create a four-point regular shape for the square shape', () => {
		const image = createNodeImage('square', 8, '#ff0000');

		expect(image).toBeInstanceOf(RegularShape);
		expect((image as RegularShape).getPoints()).toBe(4);
	});
});

describe('createSelectedStyle', () => {
	test('should use the color for fill and a 3px stroke', () => {
		const style = createSelectedStyle('#fff700');

		expect(style.getFill()?.getColor()).toBe('#fff700');
		expect(style.getStroke()?.getWidth()).toBe(3);
	});
});

describe('createAddressStyle', () => {
	test('should create a circle with the default address styling', () => {
		const style = createAddressStyle();

		expect((style.getImage() as CircleStyle).getRadius()).toBe(4);
	});
});

describe('createAddressStyleWithLabels', () => {
	test('should build the address label from street parts', () => {
		const styleFn = createAddressStyleWithLabels('#949494', 4, { enabled: true });
		const feature = makeFeature({
			street: 'Hauptstraße',
			housenumber: 5,
			house_number_suffix: 'b',
			zip_code: '24211',
			city: 'Preetz'
		});

		const styles = asStyles(styleFn(feature, 0.5));

		expect(styles).toHaveLength(2);
		expect(styles[1].getText()?.getText()).toBe('Hauptstraße 5b, 24211 Preetz');
	});

	test('should return only the geometry style above the min resolution', () => {
		const styleFn = createAddressStyleWithLabels('#949494', 4, { enabled: true });

		expect(styleFn(makeFeature({}), 2.0)).toBeInstanceOf(Style);
	});
});

describe('createNodeStyle', () => {
	test('should use the default square node image', () => {
		expect(createNodeStyle().getImage()).toBeInstanceOf(RegularShape);
	});
});

describe('createNodeStyleWithLabels', () => {
	test('should label nodes with their name below the min resolution', () => {
		const styleFn = createNodeStyleWithLabels({ enabled: true });
		const styles = asStyles(styleFn(makeFeature({ name: 'PoP-1' }), 0.5));

		expect(styles).toHaveLength(2);
		expect(styles[1].getText()?.getText()).toBe('PoP-1');
	});
});

describe('createNodeStyleByType', () => {
	test('should hide nodes whose type is configured invisible', () => {
		const styleFn = createNodeStyleByType({ Muffe: { visible: false } });

		expect(styleFn(makeFeature({ node_type: 'Muffe' }), 1.0)).toBeUndefined();
	});

	test('should fall back to node type defaults for unconfigured types', () => {
		const styleFn = createNodeStyleByType({});

		const styles = asStyles(styleFn(makeFeature({ node_type: 'POP' }), 1.0));

		expect((styles[0].getImage() as RegularShape).getRadius()).toBe(22);
	});

	test('should reuse cached geometry styles for the same type', () => {
		const styleFn = createNodeStyleByType({});
		const feature = makeFeature({ node_type: 'Muffe' });

		const first = styleFn(feature, 1.0);
		const second = styleFn(feature, 1.0);

		expect(first).toBe(second);
	});

	test('should add labels below the min resolution', () => {
		const styleFn = createNodeStyleByType({}, { enabled: true });
		const styles = asStyles(styleFn(makeFeature({ node_type: 'POP', name: 'PoP-Nord' }), 0.5));

		expect(styles).toHaveLength(2);
		expect(styles[1].getText()?.getText()).toBe('PoP-Nord');
	});
});

describe('createLinkedTrenchStyle', () => {
	test('should use a dashed wide stroke', () => {
		const style = createLinkedTrenchStyle();

		expect(style.getStroke()?.getWidth()).toBe(5);
		expect(style.getStroke()?.getLineDash()).toEqual([8, 4]);
	});
});

describe('createTrenchStyleByAttribute', () => {
	test('should color trenches by their surface attribute', () => {
		const styleFn = createTrenchStyleByAttribute({ asphalt: { color: '#111111' } }, 'surface');

		const styles = asStyles(styleFn(makeFeature({ surface: 'asphalt' }), 5.0));

		expect(styles[0].getStroke()?.getColor()).toBe('#111111');
	});

	test('should color trenches by their construction type attribute', () => {
		const styleFn = createTrenchStyleByAttribute(
			{ open: { color: '#222222' } },
			'construction_type'
		);

		const styles = asStyles(styleFn(makeFeature({ construction_type: 'open' }), 5.0));

		expect(styles[0].getStroke()?.getColor()).toBe('#222222');
	});

	test('should hide trenches whose attribute value is configured invisible', () => {
		const styleFn = createTrenchStyleByAttribute({ asphalt: { visible: false } }, 'surface');

		expect(styleFn(makeFeature({ surface: 'asphalt' }), 5.0)).toBeUndefined();
	});

	test('should use the fallback color for unconfigured values', () => {
		const styleFn = createTrenchStyleByAttribute({}, 'surface', '#0033ff');

		const styles = asStyles(styleFn(makeFeature({ surface: 'gravel' }), 5.0));

		expect(styles[0].getStroke()?.getColor()).toBe('#0033ff');
	});

	test('should append labels below the min resolution', () => {
		const styleFn = createTrenchStyleByAttribute({}, 'none', '#0033ff', { enabled: true });

		const styles = asStyles(styleFn(makeFeature({ id_trench: 'T-3' }), 1.0));

		expect(styles).toHaveLength(2);
		expect(styles[1].getText()?.getText()).toBe('T-3');
	});
});

describe('createAreaStyleWithLabels', () => {
	test('should convert the hex color to a transparent rgba fill', () => {
		const styleFn = createAreaStyleWithLabels('#22c55e', 0.3);

		const styles = asStyles(styleFn(makeFeature({}), 10));

		expect(styles[0].getFill()?.getColor()).toBe('rgba(34, 197, 94, 0.3)');
		expect(styles[0].getStroke()?.getColor()).toBe('#22c55e');
	});

	test('should label areas below the min resolution', () => {
		const styleFn = createAreaStyleWithLabels('#22c55e', 0.3, { enabled: true });

		const styles = asStyles(styleFn(makeFeature({ name: 'Süd' }), 1.0));

		expect(styles).toHaveLength(2);
		expect(styles[1].getText()?.getText()).toBe('Süd');
	});
});

describe('createAreaStyleByType', () => {
	test('should hide areas whose type is configured invisible', () => {
		const styleFn = createAreaStyleByType({ forest: { visible: false } });

		expect(styleFn(makeFeature({ area_type: 'forest' }), 1.0)).toBeUndefined();
	});

	test('should use the configured color per area type', () => {
		const styleFn = createAreaStyleByType({ forest: { color: '#005500', visible: true } });

		const styles = asStyles(styleFn(makeFeature({ area_type: 'forest' }), 10));

		expect(styles[0].getStroke()?.getColor()).toBe('#005500');
	});

	test('should fall back to the default area color for unknown types', () => {
		const styleFn = createAreaStyleByType({});

		const styles = asStyles(styleFn(makeFeature({ area_type: 'meadow' }), 10));

		expect(styles[0].getStroke()?.getColor()).toBe('#22c55e');
	});
});

describe('simple style factories', () => {
	test('createDamagePointStyle should create a red marker with white outline', () => {
		const image = createDamagePointStyle().getImage() as CircleStyle;

		expect(image.getRadius()).toBe(10);
		expect(image.getStroke()?.getColor()).toBe('#ffffff');
	});

	test('createAffectedTrenchStyle should use a wide red stroke', () => {
		expect(createAffectedTrenchStyle().getStroke()?.getWidth()).toBe(5);
	});

	test('createAffectedNodeStyle should color addresses differently', () => {
		const defaultFill = (createAffectedNodeStyle().getImage() as CircleStyle).getFill();
		const addressFill = (createAffectedNodeStyle('address').getImage() as CircleStyle).getFill();

		expect(defaultFill?.getColor()).toBe('rgba(234, 88, 12, 0.9)');
		expect(addressFill?.getColor()).toBe('rgba(147, 51, 234, 0.9)');
	});

	test('createRouteStyle should apply custom color and width', () => {
		const style = createRouteStyle('#00ff00', 2);

		expect(style.getStroke()?.getColor()).toBe('#00ff00');
		expect(style.getStroke()?.getWidth()).toBe(2);
	});

	test('createHighlightStyle should create a wide stroke with a node image', () => {
		const style = createHighlightStyle();

		expect(style.getStroke()?.getWidth()).toBe(8);
		expect(style.getImage()).toBeInstanceOf(RegularShape);
	});

	test('createMeasureStyle should use the measurement accent color', () => {
		expect(createMeasureStyle().getStroke()?.getColor()).toBe('#ffcc33');
	});

	test('createSearchHighlightStyle should derive transparent fill from the color', () => {
		const style = createSearchHighlightStyle('#ff0000');

		expect(style.getFill()?.getColor()).toBe('#ff000040');
		expect(style.getStroke()?.getLineDash()).toEqual([10, 10]);
	});
});

describe('createInquiryPolygonStyleWithLabels', () => {
	test('should label named polygons below the min resolution', () => {
		const styleFn = createInquiryPolygonStyleWithLabels();

		const styles = asStyles(styleFn(makeFeature({ name: 'Anfrage 1' }), 1.0));

		expect(styles).toHaveLength(2);
		expect(styles[1].getText()?.getText()).toBe('Anfrage 1');
	});

	test('should return only the geometry style for unnamed polygons', () => {
		const styleFn = createInquiryPolygonStyleWithLabels();

		expect(styleFn(makeFeature({}), 1.0)).toBeInstanceOf(Style);
	});

	test('should return only the geometry style above the min resolution', () => {
		const styleFn = createInquiryPolygonStyleWithLabels();

		expect(styleFn(makeFeature({ name: 'Anfrage 1' }), 10)).toBeInstanceOf(Style);
	});
});
