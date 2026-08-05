import type { Cookies } from '@sveltejs/kit';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	exportNodeExcel,
	getAddressesForNode,
	getCablesAtNode,
	getComponentPorts,
	getComponentTypes,
	getContainerHierarchy,
	getContainerTypes,
	getFiberColors,
	getFibersForCable,
	getFiberSplices,
	getFiberUsageInNode,
	getNodeStructures,
	getSlotClipNumbers,
	getSlotConfigurationsForNode,
	getSlotDividers,
	getUsedResidentialUnits,
	mapNodesToOptions
} from './nodeData';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (status: number, data: { error: string }) => {
		return { status, data };
	}
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: () => ({ Authorization: 'Token mock-token' })
}));

const AUTH_HEADERS = { Authorization: 'Token mock-token' };
const mockCookies = {} as Cookies;

function okFetch(data: unknown): Mock {
	return vi.fn().mockResolvedValue({
		ok: true,
		json: () => Promise.resolve(data)
	});
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getFiberUsageInNode', () => {
	let mockFetch: Mock;
	let mockCookies: { get: Mock };

	beforeEach(() => {
		vi.clearAllMocks();
		mockCookies = { get: vi.fn(() => 'mock-token') };
		mockFetch = vi.fn();
	});

	test('returns fiberComponentMap with component type and port number', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					used_uuids: ['fiber-a1', 'fiber-b1', 'fiber-a2'],
					fiber_component_map: {
						'fiber-a1': {
							component_type: 'Spleißkassette',
							slot_start: 6,
							port_number: 1,
							side: 'A'
						},
						'fiber-b1': {
							component_type: 'Spleißkassette',
							slot_start: 6,
							port_number: 1,
							side: 'A'
						},
						'fiber-a2': {
							component_type: 'Splitter 1:8',
							slot_start: 12,
							port_number: 3,
							side: 'B'
						}
					}
				})
		});

		const result = await getFiberUsageInNode(mockFetch, mockCookies as any, 'node-1');

		expect('usedFiberUuids' in result).toBe(true);
		if (!('usedFiberUuids' in result)) return;

		expect(result.usedFiberUuids).toContain('fiber-a1');
		expect(result.usedFiberUuids).toContain('fiber-b1');
		expect(result.usedFiberUuids).toContain('fiber-a2');

		expect(result.fiberComponentMap).toBeDefined();
		expect(result.fiberComponentMap['fiber-a1']).toEqual({
			component_type: 'Spleißkassette',
			slot_start: 6,
			port_number: 1,
			side: 'A'
		});
		expect(result.fiberComponentMap['fiber-b1']).toEqual({
			component_type: 'Spleißkassette',
			slot_start: 6,
			port_number: 1,
			side: 'A'
		});
		expect(result.fiberComponentMap['fiber-a2']).toEqual({
			component_type: 'Splitter 1:8',
			slot_start: 12,
			port_number: 3,
			side: 'B'
		});
	});

	test('returns empty map when backend does not include component map', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ used_uuids: ['fiber-1'] })
		});

		const result = await getFiberUsageInNode(mockFetch, mockCookies as any, 'node-1');

		if (!('usedFiberUuids' in result)) return;

		expect(result.usedFiberUuids).toContain('fiber-1');
		expect(result.fiberComponentMap).toEqual({});
	});

	test('returns fail when API responds with error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: () => Promise.resolve({ detail: 'Server error' })
		});

		const result = await getFiberUsageInNode(mockFetch, mockCookies as any, 'node-1');
		const failResult = result as { status: number; data: { error: string } };

		expect(failResult.status).toBe(500);
		expect(failResult.data.error).toBe('Server error');
	});

	test('returns fail for missing nodeUuid', async () => {
		const result = await getFiberUsageInNode(mockFetch, mockCookies as any, '');
		const failResult = result as { status: number; data: { error: string } };

		expect(failResult.status).toBe(400);
	});
});

describe('getUsedResidentialUnits', () => {
	let mockFetch: Mock;
	let mockCookies: { get: Mock };

	beforeEach(() => {
		vi.clearAllMocks();
		mockCookies = { get: vi.fn(() => 'mock-token') };
		mockFetch = vi.fn();
	});

	test('returns residentialUnitComponentMap alongside used_uuids', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					used_uuids: ['ru-1', 'ru-2'],
					residential_unit_component_map: {
						'ru-1': {
							component_type: 'GF-GV (4 WE)',
							slot_start: 5,
							port_number: 2,
							side: 'A'
						},
						'ru-2': {
							component_type: 'Splitter 1:8',
							slot_start: 10,
							port_number: 1,
							side: 'B'
						}
					}
				})
		});

		const result = await getUsedResidentialUnits(mockFetch, mockCookies as any, 'node-1');

		if (!('used_uuids' in result)) return;

		expect(result.used_uuids).toEqual(['ru-1', 'ru-2']);
		expect(result.residentialUnitComponentMap).toBeDefined();
		expect(result.residentialUnitComponentMap['ru-1']).toEqual({
			component_type: 'GF-GV (4 WE)',
			slot_start: 5,
			port_number: 2,
			side: 'A'
		});
		expect(result.residentialUnitComponentMap['ru-2']).toEqual({
			component_type: 'Splitter 1:8',
			slot_start: 10,
			port_number: 1,
			side: 'B'
		});
	});

	test('returns empty map when backend does not include component map', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ used_uuids: ['ru-1'] })
		});

		const result = await getUsedResidentialUnits(mockFetch, mockCookies as any, 'node-1');

		if (!('used_uuids' in result)) return;

		expect(result.used_uuids).toEqual(['ru-1']);
		expect(result.residentialUnitComponentMap).toEqual({});
	});

	test('returns fail for missing nodeUuid', async () => {
		const result = await getUsedResidentialUnits(mockFetch, mockCookies as any, '');
		const failResult = result as { status: number; data: { error: string } };

		expect(failResult.status).toBe(400);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test('returns fail when API responds with error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 403,
			json: () => Promise.resolve({ detail: 'Forbidden' })
		});

		const result = await getUsedResidentialUnits(mockFetch, mockCookies as any, 'node-1');
		const failResult = result as { status: number; data: { error: string } };

		expect(failResult.status).toBe(403);
		expect(failResult.data.error).toBe('Forbidden');
	});

	test('returns fail with 500 on network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('offline'));

		const result = await getUsedResidentialUnits(mockFetch, mockCookies as any, 'node-1');
		const failResult = result as { status: number; data: { error: string } };

		expect(failResult.status).toBe(500);
	});
});

describe('mapNodesToOptions', () => {
	test('maps GeoJSON features using id and properties.name', () => {
		const result = mapNodesToOptions({
			features: [
				{ id: 'feat-1', properties: { name: 'Node One' } },
				{ id: 'feat-2', properties: { name: 'Node Two' } }
			]
		});

		expect(result).toEqual([
			{ value: 'feat-1', label: 'Node One' },
			{ value: 'feat-2', label: 'Node Two' }
		]);
	});

	test('maps the nodes array using uuid fallback for value', () => {
		const result = mapNodesToOptions({
			nodes: [{ uuid: 'node-uuid-1', name: 'Alpha' }]
		});

		expect(result).toEqual([{ value: 'node-uuid-1', label: 'Alpha' }]);
	});

	test('maps a flat array and falls back to "Unnamed Node"', () => {
		const result = mapNodesToOptions([{ uuid: 'flat-1' }]);

		expect(result).toEqual([{ value: 'flat-1', label: 'Unnamed Node' }]);
	});

	test('returns an empty array for null input', () => {
		expect(mapNodesToOptions(null)).toEqual([]);
	});
});

describe('getContainerHierarchy', () => {
	test('fetches the container tree for a node', async () => {
		const hierarchy = { uuid: 'root', name: 'Root', children: [] };
		const fetchMock = okFetch(hierarchy);

		const result = await getContainerHierarchy(fetchMock, mockCookies, 'node-1');

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/container/tree/node-1/', {
			method: 'GET',
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({ hierarchy });
	});

	test('fails without a nodeUuid', async () => {
		const fetchMock = vi.fn();

		const result = await getContainerHierarchy(fetchMock, mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: nodeUuid' }
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('propagates the backend error detail and status', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ detail: 'Not found' })
		});

		const result = await getContainerHierarchy(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 404, data: { error: 'Not found' } });
	});

	test('falls back to default error message when detail is absent', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: () => Promise.reject(new Error('no body'))
		});

		const result = await getContainerHierarchy(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 500, data: { error: 'Failed to fetch hierarchy' } });
	});

	test('fails with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await getContainerHierarchy(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 500, data: { error: 'Internal server error' } });
	});
});

describe('getSlotConfigurationsForNode', () => {
	test('fetches slot configurations by node', async () => {
		const configurations = [{ uuid: 'sc-1', name: 'Config' }];
		const fetchMock = okFetch(configurations);

		const result = await getSlotConfigurationsForNode(fetchMock, mockCookies, 'node-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-slot-configuration/by-node/node-1/',
			{ method: 'GET', headers: AUTH_HEADERS }
		);
		expect(result).toEqual({ configurations });
	});

	test('fails without a nodeUuid', async () => {
		const result = await getSlotConfigurationsForNode(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: nodeUuid' }
		});
	});

	test('propagates backend error detail', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
			json: () => Promise.resolve({ detail: 'Denied' })
		});

		const result = await getSlotConfigurationsForNode(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 403, data: { error: 'Denied' } });
	});
});

describe('getNodeStructures', () => {
	test('fetches node structures filtered by slot configuration', async () => {
		const structures = [{ uuid: 'ns-1' }];
		const fetchMock = okFetch(structures);

		const result = await getNodeStructures(fetchMock, mockCookies, 'sc-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-structure/?slot_configuration=sc-1',
			{ method: 'GET', headers: AUTH_HEADERS }
		);
		expect(result).toEqual({ structures });
	});

	test('fails without a slotConfigUuid', async () => {
		const result = await getNodeStructures(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: slotConfigUuid' }
		});
	});

	test('uses default message when the error body has no detail', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: () => Promise.resolve({})
		});

		const result = await getNodeStructures(fetchMock, mockCookies, 'sc-1');

		expect(result).toEqual({ status: 500, data: { error: 'Failed to fetch node structures' } });
	});
});

describe('getComponentTypes', () => {
	test('fetches component types', async () => {
		const componentTypes = [{ uuid: 'ct-1', name: 'Splitter' }];
		const fetchMock = okFetch(componentTypes);

		const result = await getComponentTypes(fetchMock, mockCookies);

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/attributes_component_type/', {
			method: 'GET',
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({ componentTypes });
	});

	test('propagates backend error status with static message', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502 });

		const result = await getComponentTypes(fetchMock, mockCookies);

		expect(result).toEqual({ status: 502, data: { error: 'Failed to fetch component types' } });
	});

	test('fails with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await getComponentTypes(fetchMock, mockCookies);

		expect(result).toEqual({ status: 500, data: { error: 'Internal server error' } });
	});
});

describe('getCablesAtNode', () => {
	test('fetches cables connected to a node', async () => {
		const cables = [{ uuid: 'cab-1', name: 'Cable' }];
		const fetchMock = okFetch(cables);

		const result = await getCablesAtNode(fetchMock, mockCookies, 'node-1');

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/cable/at-node/node-1/', {
			method: 'GET',
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({ cables });
	});

	test('fails without a nodeUuid', async () => {
		const result = await getCablesAtNode(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: nodeUuid' }
		});
	});

	test('propagates backend error detail', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ detail: 'No node' })
		});

		const result = await getCablesAtNode(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 404, data: { error: 'No node' } });
	});
});

describe('getFibersForCable', () => {
	test('fetches fibers for a cable', async () => {
		const fibers = [{ uuid: 'f-1', fiber_number: 1 }];
		const fetchMock = okFetch(fibers);

		const result = await getFibersForCable(fetchMock, mockCookies, 'cable-1');

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/fiber/by-cable/cable-1/', {
			method: 'GET',
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({ fibers });
	});

	test('fails without a cableUuid', async () => {
		const result = await getFibersForCable(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: cableUuid' }
		});
	});

	test('fails with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await getFibersForCable(fetchMock, mockCookies, 'cable-1');

		expect(result).toEqual({ status: 500, data: { error: 'Internal server error' } });
	});
});

describe('getFiberColors', () => {
	test('fetches fiber colors', async () => {
		const fiberColors = [{ uuid: 'fc-1', name: 'Red', hex_code: '#ff0000' }];
		const fetchMock = okFetch(fiberColors);

		const result = await getFiberColors(fetchMock, mockCookies);

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/attributes_fiber_color/', {
			method: 'GET',
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({ fiberColors });
	});

	test('propagates backend error status', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await getFiberColors(fetchMock, mockCookies);

		expect(result).toEqual({ status: 500, data: { error: 'Failed to fetch fiber colors' } });
	});
});

describe('getComponentPorts', () => {
	test('fetches ports filtered by component type', async () => {
		const ports = [{ uuid: 'p-1', name: 'Port 1' }];
		const fetchMock = okFetch(ports);

		const result = await getComponentPorts(fetchMock, mockCookies, 'ct-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/attributes_component_structure/?component_type=ct-1',
			{ method: 'GET', headers: AUTH_HEADERS }
		);
		expect(result).toEqual({ ports });
	});

	test('fails without a componentTypeId', async () => {
		const result = await getComponentPorts(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: componentTypeId' }
		});
	});

	test('propagates backend error detail', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: () => Promise.resolve({ detail: 'Bad request' })
		});

		const result = await getComponentPorts(fetchMock, mockCookies, 'ct-1');

		expect(result).toEqual({ status: 400, data: { error: 'Bad request' } });
	});
});

describe('getFiberSplices', () => {
	test('fetches splices filtered by node structure', async () => {
		const splices = [{ uuid: 's-1', fiber_a: 'a', fiber_b: 'b' }];
		const fetchMock = okFetch(splices);

		const result = await getFiberSplices(fetchMock, mockCookies, 'ns-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/fiber-splice/?node_structure=ns-1',
			{ method: 'GET', headers: AUTH_HEADERS }
		);
		expect(result).toEqual({ splices });
	});

	test('fails without a nodeStructureUuid', async () => {
		const result = await getFiberSplices(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: nodeStructureUuid' }
		});
	});

	test('fails with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await getFiberSplices(fetchMock, mockCookies, 'ns-1');

		expect(result).toEqual({ status: 500, data: { error: 'Internal server error' } });
	});
});

describe('getSlotDividers', () => {
	test('returns the array response directly', async () => {
		const dividers = [{ uuid: 'd-1', position: 1 }];
		const fetchMock = okFetch(dividers);

		const result = await getSlotDividers(fetchMock, mockCookies, 'sc-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-slot-divider/?slot_configuration=sc-1',
			{ method: 'GET', headers: AUTH_HEADERS }
		);
		expect(result).toEqual({ dividers });
	});

	test('unwraps a paginated results envelope', async () => {
		const dividers = [{ uuid: 'd-2', position: 2 }];
		const fetchMock = okFetch({ results: dividers });

		const result = await getSlotDividers(fetchMock, mockCookies, 'sc-1');

		expect(result).toEqual({ dividers });
	});

	test('returns an empty array when the envelope has no results', async () => {
		const fetchMock = okFetch({});

		const result = await getSlotDividers(fetchMock, mockCookies, 'sc-1');

		expect(result).toEqual({ dividers: [] });
	});

	test('fails without a slotConfigUuid', async () => {
		const result = await getSlotDividers(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: slotConfigUuid' }
		});
	});

	test('propagates backend error detail', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: () => Promise.resolve({ detail: 'Boom' })
		});

		const result = await getSlotDividers(fetchMock, mockCookies, 'sc-1');

		expect(result).toEqual({ status: 500, data: { error: 'Boom' } });
	});
});

describe('getSlotClipNumbers', () => {
	test('returns the array response directly', async () => {
		const clipNumbers = [{ uuid: 'cn-1', clip_number: 1 }];
		const fetchMock = okFetch(clipNumbers);

		const result = await getSlotClipNumbers(fetchMock, mockCookies, 'sc-1');

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-slot-clip-number/?slot_configuration=sc-1',
			{ method: 'GET', headers: AUTH_HEADERS }
		);
		expect(result).toEqual({ clipNumbers });
	});

	test('unwraps a paginated results envelope', async () => {
		const clipNumbers = [{ uuid: 'cn-2', clip_number: 2 }];
		const fetchMock = okFetch({ results: clipNumbers });

		const result = await getSlotClipNumbers(fetchMock, mockCookies, 'sc-1');

		expect(result).toEqual({ clipNumbers });
	});

	test('fails without a slotConfigUuid', async () => {
		const result = await getSlotClipNumbers(vi.fn(), mockCookies, '');

		expect(result).toEqual({
			status: 400,
			data: { error: 'Missing required parameter: slotConfigUuid' }
		});
	});
});

describe('getContainerTypes', () => {
	test('fetches container types', async () => {
		const containerTypes = [{ uuid: 'ctype-1', name: 'Rack' }];
		const fetchMock = okFetch(containerTypes);

		const result = await getContainerTypes(fetchMock, mockCookies);

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/container-type/', {
			method: 'GET',
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({ containerTypes });
	});

	test('propagates backend error status', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });

		const result = await getContainerTypes(fetchMock, mockCookies);

		expect(result).toEqual({ status: 503, data: { error: 'Failed to fetch container types' } });
	});

	test('fails with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await getContainerTypes(fetchMock, mockCookies);

		expect(result).toEqual({ status: 500, data: { error: 'Internal server error' } });
	});
});

describe('getAddressesForNode', () => {
	test('returns the addresses array from the response envelope', async () => {
		const addresses = [{ uuid: 'addr-1', street: 'Main St' }];
		const fetchMock = okFetch({ addresses });

		const result = await getAddressesForNode(fetchMock, mockCookies, 'node-1');

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/node/node-1/addresses/', {
			method: 'GET',
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({ addresses });
	});

	test('defaults to an empty array when the envelope has no addresses', async () => {
		const fetchMock = okFetch({});

		const result = await getAddressesForNode(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ addresses: [] });
	});

	test('fails without a nodeUuid', async () => {
		const result = await getAddressesForNode(vi.fn(), mockCookies, '');

		expect(result).toEqual({ status: 400, data: { error: 'Node UUID is required' } });
	});

	test('propagates backend error detail', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ detail: 'Missing node' })
		});

		const result = await getAddressesForNode(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 404, data: { error: 'Missing node' } });
	});
});

describe('exportNodeExcel', () => {
	test('encodes the response body as base64 and reads the filename header', async () => {
		const bytes = new TextEncoder().encode('excel-bytes');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: () => Promise.resolve(bytes.buffer),
			headers: {
				get: (name: string) =>
					name === 'Content-Disposition' ? 'attachment; filename="node-report.xlsx"' : null
			}
		});

		const result = await exportNodeExcel(fetchMock, mockCookies, 'node-1');

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/node-export/excel/node-1/', {
			headers: AUTH_HEADERS
		});
		expect(result).toEqual({
			fileData: Buffer.from('excel-bytes').toString('base64'),
			fileName: 'node-report.xlsx'
		});
	});

	test('falls back to structure.xlsx when no filename header is present', async () => {
		const bytes = new TextEncoder().encode('data');
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: () => Promise.resolve(bytes.buffer),
			headers: { get: () => null }
		});

		const result = await exportNodeExcel(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({
			fileData: Buffer.from('data').toString('base64'),
			fileName: 'structure.xlsx'
		});
	});

	test('fails without a nodeUuid', async () => {
		const result = await exportNodeExcel(vi.fn(), mockCookies, '');

		expect(result).toEqual({ status: 400, data: { error: 'Missing nodeUuid' } });
	});

	test('propagates backend error status', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await exportNodeExcel(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 500, data: { error: 'Export failed' } });
	});

	test('fails with 500 on network errors', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await exportNodeExcel(fetchMock, mockCookies, 'node-1');

		expect(result).toEqual({ status: 500, data: { error: 'Export failed' } });
	});
});
