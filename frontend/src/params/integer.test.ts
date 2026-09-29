import { describe, expect, test } from 'vitest';

import { match } from './integer';

describe('integer param matcher', () => {
	test('should accept digit-only segments', () => {
		expect(match('5')).toBe(true);
		expect(match('0')).toBe(true);
		expect(match('123456')).toBe(true);
	});

	test('should reject anything that is not a plain integer', () => {
		expect(match('')).toBe(false);
		expect(match('5a')).toBe(false);
		expect(match('-1')).toBe(false);
		expect(match('1.5')).toBe(false);
		expect(match(' 5')).toBe(false);
	});
});
