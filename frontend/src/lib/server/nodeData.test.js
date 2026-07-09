import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getFiberUsageInNode, getUsedResidentialUnits } from './nodeData.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (/** @type {number} */ status, /** @type {any} */ data) => {
		return { status, data };
	}
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: () => ({ Authorization: 'Token mock-token' })
}));

describe('getFiberUsageInNode', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

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

		const result = await getFiberUsageInNode(mockFetch, mockCookies, 'node-1');

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

		const result = await getFiberUsageInNode(mockFetch, mockCookies, 'node-1');

		expect(result.usedFiberUuids).toContain('fiber-1');
		expect(result.fiberComponentMap).toEqual({});
	});

	test('returns fail when API responds with error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: () => Promise.resolve({ detail: 'Server error' })
		});

		const result = await getFiberUsageInNode(mockFetch, mockCookies, 'node-1');

		expect(result.status).toBe(500);
		expect(result.data.error).toBe('Server error');
	});

	test('returns fail for missing nodeUuid', async () => {
		const result = await getFiberUsageInNode(mockFetch, mockCookies, '');

		expect(result.status).toBe(400);
	});
});

describe('getUsedResidentialUnits', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

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

		const result = await getUsedResidentialUnits(mockFetch, mockCookies, 'node-1');

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

		const result = await getUsedResidentialUnits(mockFetch, mockCookies, 'node-1');

		expect(result.used_uuids).toEqual(['ru-1']);
		expect(result.residentialUnitComponentMap).toEqual({});
	});
});
