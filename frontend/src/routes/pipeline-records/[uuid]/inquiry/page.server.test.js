import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (/** @type {number} */ status, /** @type {any} */ data) => ({ status, data })
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

vi.mock('$lib/server/attributes', () => ({
	getNodeTypes: vi.fn(),
	getSurfaces: vi.fn(),
	getConstructionTypes: vi.fn(),
	getAreaTypes: vi.fn()
}));

const { load, actions } = await import('./+page.server.js');
const { getNodeTypes, getSurfaces, getConstructionTypes, getAreaTypes } =
	await import('$lib/server/attributes');

describe('pipeline inquiry +page.server.js', () => {
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

		getNodeTypes.mockResolvedValue({ nodeTypes: [] });
		getSurfaces.mockResolvedValue({ surfaces: [] });
		getConstructionTypes.mockResolvedValue({ constructionTypes: [] });
		getAreaTypes.mockResolvedValue({ areaTypes: [] });
	});

	describe('load function', () => {
		test('should return recordExists true and inquiry areas when record is found', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						features: [{ properties: { uuid: 'area-1', name: 'Test Area' }, geometry: {} }]
					})
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'test-uuid' }
					})
				)
			);

			expect(result.recordExists).toBe(true);
			expect(result.inquiryAreas).toHaveLength(1);
			expect(result.inquiryAreas[0].properties.uuid).toBe('area-1');
		});

		test('should return recordExists false when pipeline record is not found', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'nonexistent-uuid' }
					})
				)
			);

			expect(result.recordExists).toBe(false);
		});

		test('should return empty inquiry areas when API returns error', async () => {
			mockFetch
				.mockResolvedValueOnce({ ok: true })
				.mockResolvedValueOnce({ ok: false, status: 500 });

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'test-uuid' }
					})
				)
			);

			expect(result.recordExists).toBe(true);
			expect(result.inquiryAreas).toEqual([]);
		});

		test('should call the correct API endpoints', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			await load(
				/** @type {any} */ ({
					fetch: mockFetch,
					cookies: mockCookies,
					params: { uuid: 'my-uuid' }
				})
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-records/my-uuid/',
				expect.objectContaining({
					credentials: 'include',
					headers: { Cookie: 'api-access-token=mock-token' }
				})
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-inquiry-areas/?pipeline_record=my-uuid',
				expect.objectContaining({
					credentials: 'include',
					headers: { Cookie: 'api-access-token=mock-token' }
				})
			);
		});
	});

	describe('savePolygon action', () => {
		/**
		 * @param {Record<string, string>} formFields
		 * @param {Record<string, string>} [params]
		 */
		function createRequestEvent(formFields, params = { uuid: 'test-uuid' }) {
			const formData = new FormData();
			for (const [key, value] of Object.entries(formFields)) {
				formData.append(key, value);
			}
			return /** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies,
				params
			});
		}

		test('should save a polygon and return success', async () => {
			const savedPolygon = {
				properties: { uuid: 'saved-uuid', name: null },
				geometry: {
					type: 'Polygon',
					coordinates: [
						[
							[0, 0],
							[1, 0],
							[1, 1],
							[0, 0]
						]
					]
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(savedPolygon)
			});

			const result = /** @type {any} */ (
				await actions.savePolygon(
					createRequestEvent({
						geojson: JSON.stringify({
							type: 'Polygon',
							coordinates: [
								[
									[0, 0],
									[1, 0],
									[1, 1],
									[0, 0]
								]
							]
						})
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.polygon).toEqual(savedPolygon);
		});

		test('should fail when geojson is missing', async () => {
			const result = /** @type {any} */ (await actions.savePolygon(createRequestEvent({})));

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Polygon geometry is required');
		});

		test('should fail when geojson is invalid', async () => {
			const result = /** @type {any} */ (
				await actions.savePolygon(createRequestEvent({ geojson: 'not-json' }))
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid GeoJSON');
		});

		test('should forward API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				json: () => Promise.resolve({ detail: 'Invalid polygon' })
			});

			const result = /** @type {any} */ (
				await actions.savePolygon(
					createRequestEvent({
						geojson: JSON.stringify({ type: 'Polygon', coordinates: [] })
					})
				)
			);

			expect(result.status).toBe(422);
			expect(result.data.message).toBe('Invalid polygon');
		});
	});

	describe('deletePolygon action', () => {
		/**
		 * @param {Record<string, string>} formFields
		 */
		function createRequestEvent(formFields) {
			const formData = new FormData();
			for (const [key, value] of Object.entries(formFields)) {
				formData.append(key, value);
			}
			return /** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'test-uuid' }
			});
		}

		test('should delete a polygon and return success', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			const result = /** @type {any} */ (
				await actions.deletePolygon(createRequestEvent({ polygonUuid: 'polygon-uuid' }))
			);

			expect(result.success).toBe(true);
			expect(result.deleted).toBe('polygon-uuid');
		});

		test('should fail when polygonUuid is missing', async () => {
			const result = /** @type {any} */ (await actions.deletePolygon(createRequestEvent({})));

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Polygon UUID is required');
		});

		test('should call DELETE on the correct endpoint', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			await actions.deletePolygon(createRequestEvent({ polygonUuid: 'my-polygon' }));

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-inquiry-areas/my-polygon/',
				expect.objectContaining({
					method: 'DELETE',
					credentials: 'include'
				})
			);
		});
	});
});
