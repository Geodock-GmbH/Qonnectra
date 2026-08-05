import { describe, expect, test, vi } from 'vitest';

import { getFieldAliases } from './fieldAliases';

vi.mock('$lib/paraglide/messages', () => ({
	m: new Proxy(
		{},
		{
			get: (_target, prop: string) => (params?: { count?: number }) =>
				params?.count !== undefined ? `${prop}:${params.count}` : `${prop}`
		}
	)
}));

describe('getFieldAliases', () => {
	test('should map feature property keys to localized message calls', () => {
		const aliases = getFieldAliases();

		expect(aliases.name).toBe('common_name');
		expect(aliases.id_trench).toBe('form_trench_id');
		expect(aliases.zip_code).toBe('form_zip_code');
	});

	test('should pass singular count for address and project labels', () => {
		const aliases = getFieldAliases();

		expect(aliases.address).toBe('form_address:1');
		expect(aliases.project).toBe('form_project:1');
	});

	test('should pass plural count for conduit names', () => {
		expect(getFieldAliases().conduit_names).toBe('form_conduit:2');
	});

	test('should provide an alias for every documented feature field', () => {
		const aliases = getFieldAliases();
		const expectedKeys = [
			'flag',
			'name',
			'status',
			'network_level',
			'owner',
			'company',
			'constructor',
			'manufacturer',
			'date',
			'node_type',
			'warranty',
			'surface',
			'construction_type',
			'id_trench',
			'length',
			'phase',
			'construction_depth',
			'construction_details',
			'internal_execution',
			'funding_status',
			'comment',
			'address',
			'id_address',
			'zip_code',
			'city',
			'district',
			'street',
			'housenumber',
			'house_number_suffix',
			'status_development',
			'house_connection',
			'area_type',
			'conduit_names',
			'parent_node_name',
			'project'
		];
		expect(Object.keys(aliases).sort()).toEqual(expectedKeys.sort());
	});
});
