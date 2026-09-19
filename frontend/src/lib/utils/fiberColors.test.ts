import type { FiberColor } from '$lib/types/nodeData';
import { describe, expect, test } from 'vitest';

import { fiberColorHex, fiberColorName } from './fiberColors';

const colors: FiberColor[] = [
	{ id: 1, name_de: 'Rot', name_en: 'Red', hex_code: '#ff0000', display_order: 1 }
];

describe('fiberColorHex', () => {
	test('should resolve a color by its German or English name, ignoring case', () => {
		expect(fiberColorHex(colors, 'rot')).toBe('#ff0000');
		expect(fiberColorHex(colors, 'Red')).toBe('#ff0000');
	});

	test('should fall back to grey for unknown or missing colors', () => {
		expect(fiberColorHex(colors, 'unbekannt')).toBe('#808080');
		expect(fiberColorHex(colors, '')).toBe('#808080');
		expect(fiberColorHex([], 'rot')).toBe('#808080');
	});
});

describe('fiberColorName', () => {
	test('should translate a color name to the given locale', () => {
		expect(fiberColorName(colors, 'red', 'de')).toBe('Rot');
		expect(fiberColorName(colors, 'rot', 'en')).toBe('Red');
	});

	test('should keep the name of an unknown color', () => {
		expect(fiberColorName(colors, 'unbekannt', 'de')).toBe('unbekannt');
		expect(fiberColorName(colors, '', 'en')).toBe('');
	});
});
