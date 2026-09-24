import { describe, expect, test, vi } from 'vitest';

import { cableEndLabel } from './cableEnds';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

describe('cableEndLabel', () => {
	test('should name the end and which side of its cable it is', () => {
		expect(cableEndLabel({ id: 'n-1', name: 'Haus 5', direction: 'end', is_default: false })).toBe(
			'Haus 5 (signal_source_cable_end)'
		);
	});

	test('should mark the end the backend falls back to', () => {
		expect(cableEndLabel({ id: 'n-1', name: 'PoP-1', direction: 'start', is_default: true })).toBe(
			'PoP-1 (signal_source_cable_start) (common_default)'
		);
	});
});
