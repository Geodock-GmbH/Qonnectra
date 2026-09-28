import { describe, expect, test } from 'vitest';

import { displayProperties, featureProjectId, featureTitle } from './featureDetails';

const trench = {
	id_trench: 'T-42',
	project: { id: 7, project: 'Nord', description: '', active: true },
	length: '12.50',
	surface: { id: 1, surface: 'Asphalt', sealing: true },
	construction_type: { id: 2, construction_type: 'Offen' },
	status: { id: 3, status: 'geplant' },
	phase: null,
	owner: { id: 5, company: 'Stadtwerke' },
	constructor: { id: 6, company: 'Tiefbau GmbH' },
	flag: { id: 9, flag: 'Bau' },
	geom_3857: { type: 'LineString', coordinates: [] },
	comment: null
};

describe('displayProperties', () => {
	test('should flatten nested references of a trench to their labels', () => {
		expect(displayProperties('trench', trench, { conduitNames: ['R1', 'R2'] })).toEqual({
			id_trench: 'T-42',
			project: '7',
			length: '12.50',
			owner: 'Stadtwerke',
			constructor: 'Tiefbau GmbH',
			construction_type: 'Offen',
			status: 'geplant',
			surface: 'Asphalt',
			flag: 'Bau',
			conduit_names: 'R1, R2'
		});
	});

	test('should not mistake the object prototype for a constructor company', () => {
		const display = displayProperties('trench', { id_trench: 'T-1' });

		expect(display).toEqual({ id_trench: 'T-1' });
		expect(Object.hasOwn(display, 'constructor')).toBe(false);
	});

	test('should compose a node address and parent name from the nested records', () => {
		const display = displayProperties('node', {
			name: 'PoP-1',
			project: 3,
			node_type: { id: 1, node_type: 'Muffe' },
			uuid_address: {
				type: 'Feature',
				properties: { street: 'Hauptstraße', housenumber: 12, house_number_suffix: 'a' }
			},
			parent_node: { uuid: 'p', name: 'PoP-0' },
			manufacturer: { id: 2, company: 'Hersteller' },
			funding_status: false,
			canvas_x: 5
		});

		expect(display).toEqual({
			name: 'PoP-1',
			project: '3',
			funding_status: false,
			node_type: 'Muffe',
			address: 'Hauptstraße 12a',
			parent_node_name: 'PoP-0',
			manufacturer: 'Hersteller'
		});
	});

	test('should map an address development status to the status key', () => {
		expect(
			displayProperties('address', {
				id_address: 'A-7',
				status_development: { id: 4, status: 'angeschlossen' },
				id_address_2: 'ignored'
			})
		).toEqual({ id_address: 'A-7', status: 'angeschlossen' });
	});

	test('should keep an area to its name, type and flag', () => {
		expect(
			displayProperties('area', { name: 'Süd', area_type: { id: 1, area_type: 'Cluster' } })
		).toEqual({ name: 'Süd', area_type: 'Cluster' });
	});
});

describe('featureTitle', () => {
	test('should title a trench by its id', () => {
		expect(featureTitle('trench', { id_trench: 'T-42' })).toBe('T-42');
	});

	test('should title an address by its full line, falling back to the id', () => {
		expect(
			featureTitle('address', {
				street: 'Hauptstraße',
				housenumber: 12,
				house_number_suffix: 'a',
				zip_code: '24211',
				city: 'Preetz'
			})
		).toBe('Hauptstraße 12a, 24211 Preetz');
		expect(featureTitle('address', { id_address: 'A-7' })).toBe('A-7');
	});

	test('should title nodes and areas by name and stay empty without one', () => {
		expect(featureTitle('node', { name: 'PoP-1' })).toBe('PoP-1');
		expect(featureTitle('area', {})).toBe('');
	});
});

describe('featureProjectId', () => {
	test('should read the project id from a nested project or a bare id', () => {
		expect(featureProjectId({ id: 'x', properties: { project: { id: 7 } } })).toBe('7');
		expect(featureProjectId({ id: 'x', properties: { project: 7 } })).toBe('7');
		expect(featureProjectId({ id: 'x', properties: {} })).toBeNull();
	});
});
