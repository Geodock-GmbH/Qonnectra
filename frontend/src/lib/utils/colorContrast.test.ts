import { describe, expect, test } from 'vitest';

import { isLightColor } from './colorContrast';

describe('isLightColor', () => {
	test('should treat white, yellow and other pale colors as light', () => {
		expect(isLightColor('#ffffff')).toBe(true);
		expect(isLightColor('#FFF')).toBe(true);
		expect(isLightColor('#ffff00')).toBe(true);
		expect(isLightColor('#00ffff')).toBe(true);
	});

	test('should treat saturated and dark colors as not light', () => {
		expect(isLightColor('#000000')).toBe(false);
		expect(isLightColor('#3b82f6')).toBe(false);
		expect(isLightColor('#ff0000')).toBe(false);
		expect(isLightColor('#22c55e')).toBe(false);
		expect(isLightColor('#808080')).toBe(false);
	});

	test('should treat missing or unparsable colors as not light', () => {
		expect(isLightColor(undefined)).toBe(false);
		expect(isLightColor(null)).toBe(false);
		expect(isLightColor('')).toBe(false);
		expect(isLightColor('weiss')).toBe(false);
		expect(isLightColor('#ffffffff')).toBe(false);
	});
});
