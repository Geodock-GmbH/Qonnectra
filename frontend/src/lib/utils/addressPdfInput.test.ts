import type { AddressRecord } from '$lib/remote/address/address-data';
import type { ResidentialUnit } from '$lib/types';
import { describe, expect, test, vi } from 'vitest';

import { addressPdfLabels, toPdfAddress, toPdfUnit } from './addressPdfInput';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => () => `${prop}`
		}
	)
}));

const address: AddressRecord = {
	uuid: 'addr-1',
	id_address: 'ABC1234',
	id_address_2: null,
	street: 'Main St',
	housenumber: 12,
	house_number_suffix: 'a',
	zip_code: '10115',
	city: 'Berlin',
	district: '',
	status_development: { id: 3, status: 'Planned' },
	flag: null,
	project: { id: 1, project: 'Demo' },
	geom_3857: null
};

const location = { coordsDefault: '400000, 5800000', coords4326: '52.5, 13.4', srid: 25832 };

describe('toPdfAddress', () => {
	test('should stringify the house number and attach the location', () => {
		expect(toPdfAddress(address, location)).toEqual(
			expect.objectContaining({
				street: 'Main St',
				housenumber: '12',
				status_development: { id: 3, status: 'Planned' },
				flag: undefined,
				project: { project: 'Demo' },
				coordsDefault: '400000, 5800000',
				coords4326: '52.5, 13.4',
				srid: 25832
			})
		);
	});

	test('should drop the nulls of an address without number, project or location', () => {
		const pdfAddress = toPdfAddress(
			{ ...address, housenumber: null, status_development: null, project: null },
			{ coordsDefault: null, coords4326: null, srid: 25832 }
		);

		expect(pdfAddress.housenumber).toBe('');
		expect(pdfAddress.status_development).toBeUndefined();
		expect(pdfAddress.project).toBeUndefined();
		expect(pdfAddress.coordsDefault).toBeUndefined();
		expect(pdfAddress.coords4326).toBeUndefined();
	});
});

describe('toPdfUnit', () => {
	const unit: ResidentialUnit = {
		uuid: 'ru-1',
		uuid_address: 'addr-1',
		uuid_address_id: 'addr-1',
		residential_unit_type: { id: 1, residential_unit_type: 'Apartment' },
		status: { id: 1, status: 'Active' },
		id_residential_unit: 'RU-001',
		floor: null,
		side: 'left'
	};

	test('should attach the fiber connections of the unit and drop nulls', () => {
		expect(toPdfUnit(unit, { 'ru-1': [{ cable_name: 'K-Nord' }], 'ru-2': [] })).toEqual(
			expect.objectContaining({
				id_residential_unit: 'RU-001',
				floor: undefined,
				side: 'left',
				fiberConnections: [{ cable_name: 'K-Nord' }]
			})
		);
	});

	test('should give a unit without connections an empty list', () => {
		expect(toPdfUnit(unit, {}).fiberConnections).toEqual([]);
	});
});

describe('addressPdfLabels', () => {
	test('should carry the comment section title next to the address labels', () => {
		const labels = addressPdfLabels();

		expect(labels.sectionAddressInformation).toBe('section_address_information');
		expect(labels.sectionComment).toBe('pc_section_comment');
	});
});
