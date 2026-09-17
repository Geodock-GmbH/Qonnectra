import { describe, expect, test } from 'vitest';

import { buildResidentialUnitCreateBody, buildResidentialUnitPatch } from './residential-unit-data';

describe('buildResidentialUnitCreateBody', () => {
	test('should link the address and include provided fields', () => {
		const body = buildResidentialUnitCreateBody('addr-1', {
			id_residential_unit: 'RU-001',
			floor: 2,
			side: 'left',
			building_section: 'B',
			residential_unit_type_id: 1,
			status_id: 2,
			external_id_1: 'ext-1',
			external_id_2: '',
			resident_name: 'Jane Doe',
			resident_recorded_date: '2024-01-01',
			ready_for_service: '2024-06-01'
		});

		expect(body).toEqual({
			uuid_address_id: 'addr-1',
			id_residential_unit: 'RU-001',
			floor: 2,
			side: 'left',
			building_section: 'B',
			residential_unit_type_id: 1,
			status_id: 2,
			external_id_1: 'ext-1',
			resident_name: 'Jane Doe',
			resident_recorded_date: '2024-01-01',
			ready_for_service: '2024-06-01'
		});
	});

	test('should keep floor 0 and drop null ids', () => {
		const body = buildResidentialUnitCreateBody('addr-1', {
			floor: 0,
			residential_unit_type_id: null,
			status_id: null
		});

		expect(body).toEqual({ uuid_address_id: 'addr-1', floor: 0 });
	});
});

describe('buildResidentialUnitPatch', () => {
	test('should send provided fields and null out emptied ones', () => {
		const body = buildResidentialUnitPatch({
			id_residential_unit: 'RU-001',
			floor: 3,
			side: '',
			building_section: null,
			residential_unit_type_id: 1,
			status_id: 2,
			external_id_1: 'ext-1',
			resident_name: '',
			resident_recorded_date: '2024-01-01'
		});

		expect(body).toEqual({
			id_residential_unit: 'RU-001',
			floor: 3,
			side: null,
			building_section: null,
			residential_unit_type_id: 1,
			status_id: 2,
			external_id_1: 'ext-1',
			resident_name: null,
			resident_recorded_date: '2024-01-01'
		});
	});

	test('should omit absent fields and unset ids', () => {
		expect(buildResidentialUnitPatch({ residential_unit_type_id: null, status_id: null })).toEqual(
			{}
		);
		expect(buildResidentialUnitPatch({ floor: 0 })).toEqual({ floor: 0 });
	});
});
