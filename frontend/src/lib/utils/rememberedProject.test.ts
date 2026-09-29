import { describe, expect, test } from 'vitest';

import { lastProjectCookie, validRememberedProject } from './rememberedProject';

const projects = [
	{ value: '7', label: 'Nord' },
	{ value: '9', label: 'Süd' }
];

describe('validRememberedProject', () => {
	test('should return the id when it names one of the projects', () => {
		expect(validRememberedProject('9', projects)).toBe('9');
	});

	test('should ignore an unknown, empty or missing id', () => {
		expect(validRememberedProject('42', projects)).toBeNull();
		expect(validRememberedProject('', projects)).toBeNull();
		expect(validRememberedProject(null, projects)).toBeNull();
		expect(validRememberedProject(undefined, projects)).toBeNull();
	});
});

describe('lastProjectCookie', () => {
	test('should set path, a one-year max-age and SameSite', () => {
		expect(lastProjectCookie('7', false)).toBe(
			'last-project=7; path=/; max-age=31536000; SameSite=Lax'
		);
	});

	test('should add Secure over https', () => {
		expect(lastProjectCookie('7', true)).toMatch(/; Secure$/);
	});
});
