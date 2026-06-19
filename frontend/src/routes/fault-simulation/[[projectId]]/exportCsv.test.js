import { describe, expect, it } from 'vitest';

import { buildCsvString } from './exportCsv.js';

/** @returns {Record<string, any>} */
function makeResult(overrides = {}) {
	return {
		trench: { uuid: 'trench-uuid', id_trench: 'T-001', construction_type: 'Open Cut' },
		conduits: [
			{ uuid: 'c1', name: 'Conduit A', conduit_type: 'Standard' },
			{ uuid: 'c2', name: 'Conduit B', conduit_type: null }
		],
		cables: [
			{
				uuid: 'k1',
				name: 'Cable 1',
				cable_type: 'Fiber',
				fiber_count: 96,
				dark_fibers: 12,
				node_start: { id: 'ns1', name: 'Node A' },
				node_end: { id: 'ne1', name: 'Node B' }
			}
		],
		affected_addresses_details: [
			{
				uuid: 'a1',
				id_address: 'A-001',
				street: 'Hauptstr',
				housenumber: '12',
				suffix: null,
				zip_code: '12345',
				city: 'Berlin',
				residential_units: [
					{
						uuid: 'ru1',
						id_residential_unit: 'RU-001',
						floor: '1',
						side: 'Left',
						type: 'FTTH',
						status: 'Active'
					},
					{
						uuid: 'ru2',
						id_residential_unit: 'RU-002',
						floor: '2',
						side: 'Right',
						type: 'FTTH',
						status: 'Active'
					}
				]
			}
		],
		...overrides
	};
}

describe('buildCsvString', () => {
	it('includes all four sections', () => {
		const csv = buildCsvString(makeResult());
		expect(csv).toContain('Section,Trench');
		expect(csv).toContain('Section,Conduits');
		expect(csv).toContain('Section,Cables');
		expect(csv).toContain('Section,Affected Addresses');
	});

	it('trench section contains id and construction type', () => {
		const csv = buildCsvString(makeResult());
		const lines = csv.split('\r\n');
		const trenchIdx = lines.findIndex((l) => l === 'Section,Trench');
		expect(lines[trenchIdx + 1]).toBe('Trench ID,Construction Type');
		expect(lines[trenchIdx + 2]).toBe('T-001,Open Cut');
	});

	it('conduits section lists name and type', () => {
		const csv = buildCsvString(makeResult());
		const lines = csv.split('\r\n');
		const idx = lines.findIndex((l) => l === 'Section,Conduits');
		expect(lines[idx + 1]).toBe('Name,Conduit Type');
		expect(lines[idx + 2]).toBe('Conduit A,Standard');
		expect(lines[idx + 3]).toBe('Conduit B,');
	});

	it('cables section lists name, type, fiber count, dark fibers, start/end nodes', () => {
		const csv = buildCsvString(makeResult());
		const lines = csv.split('\r\n');
		const idx = lines.findIndex((l) => l === 'Section,Cables');
		expect(lines[idx + 1]).toBe('Name,Cable Type,Fiber Count,Dark Fibers,Node Start,Node End');
		expect(lines[idx + 2]).toBe('Cable 1,Fiber,96,12,Node A,Node B');
	});

	it('address section generates one row per residential unit', () => {
		const csv = buildCsvString(makeResult());
		const lines = csv.split('\r\n');
		const idx = lines.findIndex((l) => l === 'Section,Affected Addresses');
		expect(lines[idx + 1]).toBe(
			'Address ID,Street,Housenumber,Zip Code,City,Residential Unit ID,Floor,Side,Type,Status'
		);
		expect(lines[idx + 2]).toBe('A-001,Hauptstr,12,12345,Berlin,RU-001,1,Left,FTTH,Active');
		expect(lines[idx + 3]).toBe('A-001,Hauptstr,12,12345,Berlin,RU-002,2,Right,FTTH,Active');
	});

	it('addresses with no residential units produce one row with empty RU fields', () => {
		const result = makeResult({
			affected_addresses_details: [
				{
					uuid: 'a2',
					id_address: 'A-002',
					street: 'Nebenstr',
					housenumber: '5',
					suffix: null,
					zip_code: '12345',
					city: 'Berlin',
					residential_units: []
				}
			]
		});
		const csv = buildCsvString(result);
		const lines = csv.split('\r\n');
		const idx = lines.findIndex((l) => l === 'Section,Affected Addresses');
		expect(lines[idx + 2]).toBe('A-002,Nebenstr,5,12345,Berlin,,,,,');
	});

	it('escapes values containing commas and quotes', () => {
		const result = makeResult({
			trench: { id_trench: 'T-"special"', construction_type: 'Type, with comma' },
			conduits: [],
			cables: [],
			affected_addresses_details: []
		});
		const csv = buildCsvString(result);
		const lines = csv.split('\r\n');
		const trenchIdx = lines.findIndex((l) => l === 'Section,Trench');
		expect(lines[trenchIdx + 2]).toBe('"T-""special""","Type, with comma"');
	});

	it('handles empty arrays gracefully', () => {
		const result = makeResult({
			conduits: [],
			cables: [],
			affected_addresses_details: []
		});
		const csv = buildCsvString(result);
		expect(csv).toContain('Section,Conduits');
		expect(csv).toContain('Section,Cables');
		expect(csv).toContain('Section,Affected Addresses');

		const lines = csv.split('\r\n');
		const conduitsIdx = lines.findIndex((l) => l === 'Section,Conduits');
		expect(lines[conduitsIdx + 1]).toBe('Name,Conduit Type');
		expect(lines[conduitsIdx + 2]).toBe('');
	});

	it('handles null/missing trench gracefully', () => {
		const result = makeResult({ trench: null });
		const csv = buildCsvString(result);
		const lines = csv.split('\r\n');
		const trenchIdx = lines.findIndex((l) => l === 'Section,Trench');
		expect(lines[trenchIdx + 2]).toBe(',');
	});
});
