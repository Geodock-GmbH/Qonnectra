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

describe('residential unit detail +page.server.js', () => {
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

	describe('load function', () => {
		test('should load residential unit successfully', async () => {
			const mockUnit = {
				uuid: 'ru-uuid',
				id_residential_unit: 'RU-001',
				floor: 2,
				side: 'left'
			};

			// unit response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockUnit)
			});
			// types
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ id: 1, residential_unit_type: 'Apartment' }])
			});
			// statuses
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ id: 1, status: 'Active' }])
			});
			// fiber connections
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ id: 1, fiber: 'Fiber 1' }])
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.unit).toEqual(mockUnit);
			expect(result.unitError).toBeNull();
			expect(result.projectId).toBe('1');
			expect(result.addressUuid).toBe('addr-uuid');
			expect(result.residentialUnitTypes).toEqual([{ value: 1, label: 'Apartment' }]);
			expect(result.residentialUnitStatuses).toEqual([{ value: 1, label: 'Active' }]);
			expect(result.fiberConnections).toHaveLength(1);
		});

		test('should handle unit fetch failure', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({})
			});
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'nonexistent' }
					})
				)
			);

			expect(result.unit).toBeNull();
			expect(result.unitError).toBe('Failed to fetch residential unit');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.unit).toBeNull();
			expect(result.unitError).toBe('Error occurred while fetching residential unit');
		});

		test('should handle failed select responses gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'ru-uuid' })
			});
			// types fail
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
			// statuses fail
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
			// fiber connections fail
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.unit).toEqual({ uuid: 'ru-uuid' });
			expect(result.residentialUnitTypes).toEqual([]);
			expect(result.residentialUnitStatuses).toEqual([]);
			expect(result.fiberConnections).toEqual([]);
		});

		test('should pass correct auth headers', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'ru-uuid' })
			});
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

			await load(
				/** @type {any} */ ({
					fetch: mockFetch,
					cookies: mockCookies,
					params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'ru-uuid' }
				})
			);

			mockFetch.mock.calls.forEach((/** @type {any} */ call) => {
				expect(call[1].headers.Cookie).toBe('api-access-token=mock-token');
			});
		});
	});

	describe('updateResidentialUnit action', () => {
		test('should update residential unit successfully', async () => {
			const updatedUnit = { uuid: 'ru-uuid', floor: 3, side: 'right' };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(updatedUnit)
			});

			const result = /** @type {any} */ (
				await actions.updateResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({
							id_residential_unit: 'RU-001',
							floor: '3',
							side: 'right',
							building_section: 'B',
							residential_unit_type_id: '1',
							status_id: '2',
							external_id_1: 'ext-1',
							external_id_2: 'ext-2',
							resident_name: 'John Doe',
							resident_recorded_date: '2024-01-01',
							ready_for_service: '2024-06-01'
						}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.unit).toEqual(updatedUnit);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.id_residential_unit).toBe('RU-001');
			expect(requestBody.floor).toBe(3);
			expect(requestBody.side).toBe('right');
			expect(requestBody.residential_unit_type_id).toBe(1);
			expect(requestBody.status_id).toBe(2);
			expect(requestBody.resident_name).toBe('John Doe');
		});

		test('should handle nullable fields', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'ru-uuid' })
			});

			await actions.updateResidentialUnit(
				/** @type {any} */ ({
					request: createMockRequest({
						floor: '',
						side: '',
						building_section: ''
					}),
					fetch: mockFetch,
					cookies: mockCookies,
					params: { unitUuid: 'ru-uuid' }
				})
			);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.floor).toBeNull();
			expect(requestBody.side).toBeNull();
			expect(requestBody.building_section).toBeNull();
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid data' })
			});

			const result = /** @type {any} */ (
				await actions.updateResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ floor: '3' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { unitUuid: 'ru-uuid' }
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
				json: () => Promise.resolve({ floor: ['Must be an integer'] })
			});

			const result = /** @type {any} */ (
				await actions.updateResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ floor: 'abc' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toContain('floor');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const result = /** @type {any} */ (
				await actions.updateResidentialUnit(
					/** @type {any} */ ({
						request: createMockRequest({ floor: '3' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Connection failed');
		});
	});

	describe('deleteResidentialUnit action', () => {
		test('should delete residential unit and redirect', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			await expect(
				actions.deleteResidentialUnit(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'ru-uuid' }
					})
				)
			).rejects.toEqual({ status: 303, location: '/address/1/addr-uuid' });

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
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.status).toBe(404);
			expect(result.data.message).toBe('Unit not found');
		});

		test('should handle delete network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network failure'));

			const result = /** @type {any} */ (
				await actions.deleteResidentialUnit(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { projectId: '1', uuid: 'addr-uuid', unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network failure');
		});
	});

	describe('regenerateId action', () => {
		test('should regenerate residential unit ID successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ id_residential_unit: 'NEW-RU-ID' })
			});

			const result = /** @type {any} */ (
				await actions.regenerateId(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.id_residential_unit).toBe('NEW-RU-ID');
			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/residential-unit/ru-uuid/regenerate-id/',
				expect.objectContaining({ method: 'POST' })
			);
		});

		test('should handle regenerate API error', async () => {
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
						params: { unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Server error');
		});

		test('should handle regenerate network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (
				await actions.regenerateId(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { unitUuid: 'ru-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network error');
		});
	});
});
