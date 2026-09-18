import { describe, expect, test } from 'vitest';

import { trenchCableTitle, trenchConduitTitle } from './trench-data';

describe('trenchConduitTitle', () => {
	test('should show the conduit name with its type in brackets', () => {
		expect(
			trenchConduitTitle({
				uuid: 'connection-1',
				conduit: { name: 'DA 50', conduit_type: { conduit_type: 'Rohr' } }
			})
		).toBe('DA 50 (Rohr)');
	});

	test('should show the bare name when the conduit has no type', () => {
		expect(trenchConduitTitle({ uuid: 'connection-1', conduit: { name: 'DA 50' } })).toBe('DA 50');
	});

	test('should fall back to a short uuid for an unnamed conduit', () => {
		expect(trenchConduitTitle({ uuid: '12345678-abcd', conduit: null })).toBe('Conduit 12345678');
	});
});

describe('trenchCableTitle', () => {
	test('should show the cable name with its type in brackets', () => {
		expect(
			trenchCableTitle({ uuid: 'cable-1', name: 'K-01', cable_type: { cable_type: '48F' } })
		).toBe('K-01 (48F)');
	});

	test('should show the bare name when the cable has no type', () => {
		expect(trenchCableTitle({ uuid: 'cable-1', name: 'K-01', cable_type: null })).toBe('K-01');
	});

	test('should fall back to a short uuid for an unnamed cable', () => {
		expect(trenchCableTitle({ uuid: '12345678-abcd' })).toBe('Cable 12345678');
	});
});
