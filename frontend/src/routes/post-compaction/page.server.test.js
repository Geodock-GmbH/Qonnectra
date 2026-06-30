import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (/** @type {number} */ status, /** @type {any} */ data) => {
		return { status, data };
	}
}));

describe('post-compaction +page.server.js', () => {
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

	describe('load function', () => {
		test('should fetch status developments and return mapped options', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve([
						{ id: 1, status: 'Planned' },
						{ id: 2, status: 'In Progress' }
					])
			});

			const result = /** @type {any} */ (
				await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }))
			);

			expect(result.statusDevelopments).toEqual([
				{ value: '1', label: 'Planned' },
				{ value: '2', label: 'In Progress' }
			]);
		});

		test('should return empty array when fetch fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500
			});

			const result = /** @type {any} */ (
				await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }))
			);

			expect(result.statusDevelopments).toEqual([]);
		});

		test('should return empty array on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (
				await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }))
			);

			expect(result.statusDevelopments).toEqual([]);
		});

		test('should pass correct auth headers', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([])
			});

			await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

			expect(mockFetch).toHaveBeenCalledTimes(1);
			expect(mockFetch.mock.calls[0][1].headers.Cookie).toBe('api-access-token=mock-token');
		});
	});

	describe('updateStatus action', () => {
		/** @param {Record<string, any>} data */
		function createMockFormData(data) {
			const map = new Map(Object.entries(data));
			return { get: (/** @type {string} */ key) => map.get(key) ?? null };
		}

		/** @param {Record<string, any>} formDataObj */
		function createMockRequest(formDataObj) {
			return /** @type {any} */ ({
				formData: () => Promise.resolve(createMockFormData(formDataObj))
			});
		}

		test('should PATCH address with new status_development_id', async () => {
			const updatedAddress = {
				id: 'addr-uuid',
				properties: {
					street: 'Main St',
					housenumber: 1,
					status_development: { id: 2, status: 'In Progress' }
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(updatedAddress)
			});

			const result = /** @type {any} */ (
				await actions.updateStatus({
					request: createMockRequest({
						uuid: 'addr-uuid',
						status_development_id: '2'
					}),
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			expect(result.success).toBe(true);
			expect(result.address).toBeDefined();
			expect(result.address.street).toBe('Main St');

			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe('http://localhost:8000/address/addr-uuid/');
			expect(options.method).toBe('PATCH');
			const body = JSON.parse(options.body);
			expect(body.status_development_id).toBe(2);
		});

		test('should return fail on API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid status' })
			});

			const result = /** @type {any} */ (
				await actions.updateStatus({
					request: createMockRequest({
						uuid: 'addr-uuid',
						status_development_id: '999'
					}),
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid status');
		});

		test('should return fail on network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (
				await actions.updateStatus({
					request: createMockRequest({
						uuid: 'addr-uuid',
						status_development_id: '2'
					}),
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network error');
		});
	});

	describe('fetchAddress action', () => {
		/** @param {Record<string, any>} data */
		function createMockFormData(data) {
			const map = new Map(Object.entries(data));
			return { get: (/** @type {string} */ key) => map.get(key) ?? null };
		}

		/** @param {Record<string, any>} formDataObj */
		function createMockRequest(formDataObj) {
			return /** @type {any} */ ({
				formData: () => Promise.resolve(createMockFormData(formDataObj))
			});
		}

		test('should fetch address and residential units in parallel', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: {
					uuid: 'addr-uuid',
					street: 'Main St',
					housenumber: 42,
					zip_code: '12345',
					city: 'Berlin',
					status_development: { id: 1, status: 'Planned' }
				}
			};

			const residentialUnits = [
				{ uuid: 'ru-1', floor: 1, side: 'left' },
				{ uuid: 'ru-2', floor: 2, side: 'right' }
			];

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(addressData)
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(residentialUnits)
			});

			const result = /** @type {any} */ (
				await actions.fetchAddress({
					request: createMockRequest({ uuid: 'addr-uuid' }),
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			expect(result.success).toBe(true);
			expect(result.address.street).toBe('Main St');
			expect(result.address.uuid).toBe('addr-uuid');
			expect(result.residentialUnits).toHaveLength(2);

			expect(mockFetch).toHaveBeenCalledTimes(2);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/address/addr-uuid/');
			expect(mockFetch.mock.calls[1][0]).toBe(
				'http://localhost:8000/residential-unit/all/?uuid_address=addr-uuid'
			);
		});

		test('should return fail when address fetch fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ detail: 'Not found' })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([])
			});

			const result = /** @type {any} */ (
				await actions.fetchAddress({
					request: createMockRequest({ uuid: 'nonexistent' }),
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			expect(result.status).toBe(404);
			expect(result.data.message).toBe('Not found');
		});

		test('should return empty residential units when that fetch fails', async () => {
			const addressData = {
				id: 'addr-uuid',
				properties: { street: 'Main St', housenumber: 1 }
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(addressData)
			});
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500
			});

			const result = /** @type {any} */ (
				await actions.fetchAddress({
					request: createMockRequest({ uuid: 'addr-uuid' }),
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			expect(result.success).toBe(true);
			expect(result.address.street).toBe('Main St');
			expect(result.residentialUnits).toEqual([]);
		});

		test('should extract properties from GeoJSON format', async () => {
			const geoJsonAddress = {
				id: 'addr-uuid',
				type: 'Feature',
				properties: {
					uuid: 'addr-uuid',
					street: 'GeoJSON St',
					housenumber: 10,
					geom_3857: { type: 'Point', coordinates: [1, 2] }
				},
				geometry: { type: 'Point', coordinates: [1, 2] }
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(geoJsonAddress)
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([])
			});

			const result = /** @type {any} */ (
				await actions.fetchAddress({
					request: createMockRequest({ uuid: 'addr-uuid' }),
					fetch: mockFetch,
					cookies: mockCookies
				})
			);

			expect(result.address.street).toBe('GeoJSON St');
			expect(result.address.uuid).toBe('addr-uuid');
		});
	});
});
