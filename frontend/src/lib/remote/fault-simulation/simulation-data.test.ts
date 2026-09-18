import { describe, expect, test } from 'vitest';

import { simulationErrorMessage } from './simulation-data';

describe('simulationErrorMessage', () => {
	test('should prefer the endpoint error key', () => {
		expect(simulationErrorMessage({ error: 'No trench found near the point' }, 'fallback')).toBe(
			'No trench found near the point'
		);
	});

	test('should fall back to the DRF detail message', () => {
		expect(simulationErrorMessage({ detail: 'Not authenticated' }, 'fallback')).toBe(
			'Not authenticated'
		);
	});

	test('should use the fallback for an unusable body', () => {
		expect(simulationErrorMessage({}, 'fallback')).toBe('fallback');
		expect(simulationErrorMessage(null, 'fallback')).toBe('fallback');
	});
});
