import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (/** @type {number} */ status, /** @type {any} */ data) => {
		return { status, data };
	},
	redirect: (/** @type {number} */ status, /** @type {string} */ location) => {
		throw { status, location };
	}
}));

describe('address detail +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn((name) => {
				if (name === 'api-access-token') return 'mock-token';
				return null;
			})
		};

		mockFetch = vi.fn();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	/** @param {Record<string, any>} data */
	function createMockFormData(data) {
		const map = new Map(Object.entries(data));
		return {
			get: (/** @type {string} */ key) => map.get(key) ?? null
		};
	}

	/** @param {Record<string, any>} formDataObj */
	function createMockRequest(formDataObj) {
		return /** @type {any} */ ({
			formData: () => Promise.resolve(createMockFormData(formDataObj))
		});
	}

	/**
	 * @param {object} [options]
	 * @param {any} [options.addressData]
	 * @param {boolean} [options.addressOk]
	 * @param {any[]} [options.statusDevelopments]
	 * @param {any[]} [options.flags]
	 * @param {any[]} [options.ruTypes]
	 * @param {any[]} [options.ruStatuses]
	 */
	function setupLoadMocks({
		addressData = { id: 'addr-uuid', properties: { street: 'Main St', housenumber: 1 } },
		addressOk = true,
		statusDevelopments = [],
		flags = [],
		ruTypes = [],
		ruStatuses = []
	} = {}) {
		// address response
		mockFetch.mockResolvedValueOnce({
			ok: addressOk,
			status: addressOk ? 200 : 404,
			json: () => Promise.resolve(addressData)
		});

		// status_development
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(statusDevelopments)
		});

		// flags
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(flags)
		});

		// residential unit types
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(ruTypes)
		});

		// residential unit statuses
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(ruStatuses)
		});

		// linked nodes
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ features: [] })
		});

		// residential units
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve([])
		});
	}

	describe('load function', () => {
		test('should load address successfully', async () => {
			setupLoadMocks({
				addressData: {
					id: 'addr-uuid',
					properties: { street: 'Main St', housenumber: 1, geom_3857: null }
				},
				statusDevelopments: [{ id: 1, status: 'Planned' }],
				flags: [{ id: 1, flag: 'Priority' }],
				ruTypes: [{ id: 1, residential_unit_type: 'Apartment' }],
				ruStatuses: [{ id: 1, status: 'Active' }]
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.address).toBeTruthy();
			expect(result.address.uuid).toBe('addr-uuid');
			expect(result.address.street).toBe('Main St');
			expect(result.addressError).toBeNull();
			expect(result.statusDevelopments).toEqual([{ value: 1, label: 'Planned' }]);
			expect(result.flags).toEqual([{ value: 1, label: 'Priority' }]);
			expect(result.residentialUnitTypes).toEqual([{ value: 1, label: 'Apartment' }]);
			expect(result.residentialUnitStatuses).toEqual([{ value: 1, label: 'Active' }]);
		});

		test('should handle address fetch failure', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({})
			});
			// select responses
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'nonexistent' }
					})
				)
			);

			expect(result.address).toBeNull();
			expect(result.addressError).toBe('Failed to fetch address');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.address).toBeNull();
			expect(result.addressError).toBe('Error occurred while fetching address');
		});

		test('should fetch linked nodes and microducts', async () => {
			// address
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ id: 'addr-uuid', properties: { street: 'Main St' } })
			});
			// 4 select responses
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			// nodes with one feature
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						features: [{ id: 'node-uuid', properties: { name: 'Node 1' } }]
					})
			});
			// microducts for node
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve([
						{
							uuid: 'md-uuid',
							number: 1,
							color: 'red',
							hex_code: '#ff0000',
							uuid_conduit: { name: 'Conduit 1', conduit_type: { conduit_type: 'Type A' } }
						}
					])
			});
			// residential units
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([])
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.linkedNodes).toHaveLength(1);
			expect(result.linkedNodes[0].uuid).toBe('node-uuid');
			expect(result.linkedMicroducts).toHaveLength(1);
			expect(result.linkedMicroducts[0].color).toBe('red');
			expect(result.linkedMicroducts[0].conduitName).toBe('Conduit 1');
		});
	});

	describe('updateAddress action', () => {
		test('should update address successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: 'addr-uuid',
						properties: { street: 'Updated St', uuid: 'addr-uuid' }
					})
			});

			const result = /** @type {any} */ (
				await actions.updateAddress(
					/** @type {any} */ ({
						request: createMockRequest({
							street: 'Updated St',
							housenumber: '10',
							zip_code: '12345',
							city: 'Berlin',
							status_development_id: '1',
							flag_id: '2',
							id_address: 'addr-001'
						}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.address.uuid).toBe('addr-uuid');

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.street).toBe('Updated St');
			expect(requestBody.housenumber).toBe(10);
			expect(requestBody.status_development_id).toBe(1);
			expect(requestBody.flag_id).toBe(2);
			expect(requestBody.id_address).toBe('ADDR-001');
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid data' })
			});

			const result = /** @type {any} */ (
				await actions.updateAddress(
					/** @type {any} */ ({
						request: createMockRequest({ street: 'Test' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid data');
		});

		test('should handle API error with field errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ housenumber: ['Must be a number'] })
			});

			const result = /** @type {any} */ (
				await actions.updateAddress(
					/** @type {any} */ ({
						request: createMockRequest({ street: 'Test' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toContain('housenumber');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const result = /** @type {any} */ (
				await actions.updateAddress(
					/** @type {any} */ ({
						request: createMockRequest({ street: 'Test' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Connection failed');
		});
	});

	describe('regenerateId action', () => {
		test('should regenerate address ID successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ properties: { id_address: 'NEW-ID' } })
			});

			const result = /** @type {any} */ (
				await actions.regenerateId(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.id_address).toBe('NEW-ID');
		});

		test('should handle API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ detail: 'Server error' })
			});

			const result = /** @type {any} */ (
				await actions.regenerateId(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Server error');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (
				await actions.regenerateId(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network error');
		});
	});

	describe('deleteAddress action', () => {
		test('should delete address and redirect', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			await expect(
				actions.deleteAddress(
					/** @type {any} */ ({
						request: createMockRequest({}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid' }
					})
				)
			).rejects.toEqual({ status: 303, location: '/address/1' });

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/address/addr-uuid/',
				expect.objectContaining({ method: 'DELETE' })
			);
		});

		test('should handle delete API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ detail: 'Address not found' })
			});

			const result = /** @type {any} */ (
				await actions.deleteAddress(
					/** @type {any} */ ({
						request: createMockRequest({}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(404);
			expect(result.data.message).toBe('Address not found');
		});

		test('should handle delete network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network failure'));

			const result = /** @type {any} */ (
				await actions.deleteAddress(
					/** @type {any} */ ({
						request: createMockRequest({}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network failure');
		});
	});

	describe('createResidentialUnit action', () => {
		test('should create residential unit successfully', async () => {
			const newUnit = { uuid: 'ru-uuid', id_residential_unit: 'RU-001' };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(newUnit)
			});

			const result = /** @type {any} */ (
				await actions.createResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({
							id_residential_unit: 'RU-001',
							floor: '2',
							side: 'left',
							building_section: 'A',
							residential_unit_type_id: '1',
							status_id: '2',
							external_id_1: 'ext-1',
							external_id_2: 'ext-2'
						}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.residentialUnit).toEqual(newUnit);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.uuid_address_id).toBe('addr-uuid');
			expect(requestBody.id_residential_unit).toBe('RU-001');
			expect(requestBody.floor).toBe(2);
			expect(requestBody.side).toBe('left');
			expect(requestBody.residential_unit_type_id).toBe(1);
			expect(requestBody.status_id).toBe(2);
		});

		test('should handle create API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Duplicate unit' })
			});

			const result = /** @type {any} */ (
				await actions.createResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ id_residential_unit: 'RU-001' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Duplicate unit');
		});

		test('should handle create network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (
				await actions.createResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'addr-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network error');
		});
	});

	describe('updateResidentialUnit action', () => {
		test('should update residential unit successfully', async () => {
			const updatedUnit = { uuid: 'ru-uuid', floor: 3 };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(updatedUnit)
			});

			const result = /** @type {any} */ (
				await actions.updateResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({
							unit_uuid: 'ru-uuid',
							floor: '3',
							side: 'right',
							residential_unit_type_id: '1',
							status_id: '2'
						}),
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.residentialUnit).toEqual(updatedUnit);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.floor).toBe(3);
			expect(requestBody.side).toBe('right');
		});

		test('should handle update API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid data' })
			});

			const result = /** @type {any} */ (
				await actions.updateResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ unit_uuid: 'ru-uuid', floor: 'abc' }),
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid data');
		});
	});

	describe('deleteResidentialUnit action', () => {
		test('should delete residential unit successfully', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			const result = /** @type {any} */ (
				await actions.deleteResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ unit_uuid: 'ru-uuid' }),
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.success).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/residential-unit/ru-uuid/',
				expect.objectContaining({ method: 'DELETE' })
			);
		});

		test('should handle delete API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ detail: 'Unit not found' })
			});

			const result = /** @type {any} */ (
				await actions.deleteResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ unit_uuid: 'ru-uuid' }),
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(404);
			expect(result.data.message).toBe('Unit not found');
		});

		test('should handle delete network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (
				await actions.deleteResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ unit_uuid: 'ru-uuid' }),
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network error');
		});
	});
});
