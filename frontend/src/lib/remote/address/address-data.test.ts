import type { Address } from '$lib/types';
import { describe, expect, test } from 'vitest';

import {
	buildAddressPatch,
	mapAddressListPage,
	mapAddressListRow,
	mapLinkedMicroducts,
	mapLinkedNodes,
	normalizeAddress
} from './address-data';

describe('normalizeAddress', () => {
	test('should flatten a GeoJSON feature and take the feature id as uuid', () => {
		const feature: Address = {
			id: 'addr-1',
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [1, 2] },
			properties: {
				street: 'Main St',
				housenumber: 12,
				house_number_suffix: 'a',
				zip_code: '10115',
				city: 'Berlin',
				district: 'Mitte',
				id_address: 'ABC1234',
				id_address_2: null,
				status_development: { id: 3, status: 'Planned' },
				flag: { id: 4, flag: 'Priority' },
				project: { id: 1, project: 'Demo' },
				geom_3857: { type: 'Point', coordinates: [100, 200] }
			}
		};

		const address = normalizeAddress(feature);

		expect(address.uuid).toBe('addr-1');
		expect(address.street).toBe('Main St');
		expect(address.housenumber).toBe(12);
		expect(address.status_development).toEqual({ id: 3, status: 'Planned' });
		expect(address.flag).toEqual({ id: 4, flag: 'Priority' });
		expect(address.geom_3857).toEqual({ type: 'Point', coordinates: [100, 200] });
		expect(address.id_address_2).toBeNull();
	});

	test('should default missing fields', () => {
		const address = normalizeAddress({ id: 'addr-2', properties: {} });

		expect(address).toEqual({
			uuid: 'addr-2',
			id_address: '',
			id_address_2: null,
			street: '',
			housenumber: null,
			house_number_suffix: '',
			zip_code: '',
			city: '',
			district: '',
			status_development: null,
			flag: null,
			project: null,
			geom_3857: null
		});
	});
});

describe('mapAddressListRow / mapAddressListPage', () => {
	test('should map list items with empty-string fallbacks', () => {
		const row = mapAddressListRow({ uuid: 'u-1', housenumber: 0 });

		expect(row.value).toBe('u-1');
		expect(row.street).toBe('');
		expect(row.housenumber).toBe(0);
		expect(row.flag).toBe('');
	});

	test('should map the pagination envelope', () => {
		const page = mapAddressListPage({
			results: [{ uuid: 'u-1', street: 'Main St' }],
			page: 2,
			page_size: 25,
			count: 51,
			total_pages: 3
		});

		expect(page.addresses).toHaveLength(1);
		expect(page.addresses[0].street).toBe('Main St');
		expect(page.pagination).toEqual({ page: 2, pageSize: 25, totalCount: 51, totalPages: 3 });
	});

	test('should default pagination and rows when the payload is empty', () => {
		expect(mapAddressListPage({})).toEqual({
			addresses: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 }
		});
	});
});

describe('mapLinkedNodes', () => {
	test('should read a bare feature collection', () => {
		const nodes = mapLinkedNodes({
			features: [
				{ id: 'n-1', properties: { name: 'Node A', parent_node: { name: 'Parent' } } },
				{ properties: { uuid: 'n-2', name: 'Node B', parent_node: null } }
			]
		});

		expect(nodes).toEqual([
			{ uuid: 'n-1', name: 'Node A', parentNodeName: 'Parent' },
			{ uuid: 'n-2', name: 'Node B', parentNodeName: '' }
		]);
	});

	test('should read a paginated feature collection', () => {
		const nodes = mapLinkedNodes({ results: { features: [{ id: 'n-1', properties: {} }] } });

		expect(nodes).toEqual([{ uuid: 'n-1', name: '', parentNodeName: '' }]);
	});
});

describe('mapLinkedMicroducts', () => {
	test('should flatten microducts with node context and hex fallback', () => {
		const node = { uuid: 'n-1', name: 'Node A', parentNodeName: 'Parent' };
		const rows = mapLinkedMicroducts(node, [
			{
				uuid: 'md-1',
				number: 3,
				color: 'blue',
				hex_code: '#0000ff',
				uuid_conduit: { name: 'DA 50', conduit_type: { conduit_type: 'Speed' } }
			},
			{ uuid: 'md-2', number: 4, color: 'red', uuid_conduit: null }
		]);

		expect(rows[0]).toEqual({
			uuid: 'md-1',
			number: 3,
			color: 'blue',
			colorHex: '#0000ff',
			conduitName: 'DA 50',
			conduitType: 'Speed',
			nodeName: 'Node A',
			nodeUuid: 'n-1',
			parentNodeName: 'Parent'
		});
		expect(rows[1].colorHex).toBe('#64748b');
		expect(rows[1].conduitName).toBe('');
	});
});

describe('buildAddressPatch', () => {
	test('should send non-empty text fields, ids, and uppercase address ids', () => {
		const body = buildAddressPatch({
			street: 'Main St',
			housenumber: 12,
			house_number_suffix: '',
			zip_code: '10115',
			city: 'Berlin',
			district: '',
			status_development_id: 3,
			flag_id: 4,
			id_address: 'abc1234',
			id_address_2: 'def5678'
		});

		expect(body).toEqual({
			street: 'Main St',
			housenumber: 12,
			zip_code: '10115',
			city: 'Berlin',
			status_development_id: 3,
			flag_id: 4,
			id_address: 'ABC1234',
			id_address_2: 'DEF5678'
		});
	});

	test('should clear id_address_2 when provided empty and omit it when absent', () => {
		expect(buildAddressPatch({ id_address_2: '' })).toEqual({ id_address_2: null });
		expect(buildAddressPatch({ id_address_2: null })).toEqual({ id_address_2: null });
		expect(buildAddressPatch({ street: 'X' })).toEqual({ street: 'X' });
	});

	test('should omit null ids and null housenumber', () => {
		expect(
			buildAddressPatch({ housenumber: null, status_development_id: null, flag_id: null })
		).toEqual({});
	});
});
