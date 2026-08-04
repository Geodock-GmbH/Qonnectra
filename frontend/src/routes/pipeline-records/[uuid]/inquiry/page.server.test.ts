import type { Mock } from 'vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (status: number, data: Record<string, unknown>) => ({ status, data })
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
	(await import('$lib/server/attributes')) as unknown as Record<string, Mock>;

describe('pipeline inquiry +page.server.js', () => {
	let mockFetch: Mock;
	let mockCookies: Record<string, unknown>;

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

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'test-uuid' }
			} as Record<string, unknown>)) as Record<string, unknown>;

			expect(result.recordExists).toBe(true);
			expect(result.inquiryAreas).toHaveLength(1);
			expect((result.inquiryAreas as Record<string, unknown>[])[0].properties).toEqual(
				expect.objectContaining({ uuid: 'area-1' })
			);
		});

		test('should return recordExists false when pipeline record is not found', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'nonexistent-uuid' }
			} as Record<string, unknown>)) as Record<string, unknown>;

			expect(result.recordExists).toBe(false);
		});

		test('should return empty inquiry areas when API returns error', async () => {
			mockFetch
				.mockResolvedValueOnce({ ok: true })
				.mockResolvedValueOnce({ ok: false, status: 500 });

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'test-uuid' }
			} as Record<string, unknown>)) as Record<string, unknown>;

			expect(result.recordExists).toBe(true);
			expect(result.inquiryAreas).toEqual([]);
		});

		test('should call the correct API endpoints', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			await load({
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'my-uuid' }
			} as Record<string, unknown>);

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
		function createRequestEvent(
			formFields: Record<string, string>,
			params: Record<string, string> = { uuid: 'test-uuid' }
		): Record<string, unknown> {
			const formData = new FormData();
			for (const [key, value] of Object.entries(formFields)) {
				formData.append(key, value);
			}
			return {
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies,
				params
			} as Record<string, unknown>;
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

			const result = (await actions.savePolygon(
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
			)) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.polygon).toEqual(savedPolygon);
		});

		test('should fail when geojson is missing', async () => {
			const result = (await actions.savePolygon(createRequestEvent({}))) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Polygon geometry is required');
		});

		test('should fail when geojson is invalid', async () => {
			const result = (await actions.savePolygon(
				createRequestEvent({ geojson: 'not-json' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Invalid GeoJSON');
		});

		test('should forward API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				json: () => Promise.resolve({ detail: 'Invalid polygon' })
			});

			const result = (await actions.savePolygon(
				createRequestEvent({
					geojson: JSON.stringify({ type: 'Polygon', coordinates: [] })
				})
			)) as Record<string, unknown>;

			expect(result.status).toBe(422);
			expect((result.data as Record<string, unknown>).message).toBe('Invalid polygon');
		});
	});

	describe('deletePolygon action', () => {
		function createRequestEvent(formFields: Record<string, string>): Record<string, unknown> {
			const formData = new FormData();
			for (const [key, value] of Object.entries(formFields)) {
				formData.append(key, value);
			}
			return {
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'test-uuid' }
			} as Record<string, unknown>;
		}

		test('should delete a polygon and return success', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			const result = (await actions.deletePolygon(
				createRequestEvent({ polygonUuid: 'polygon-uuid' })
			)) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.deleted).toBe('polygon-uuid');
		});

		test('should fail when polygonUuid is missing', async () => {
			const result = (await actions.deletePolygon(createRequestEvent({}))) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Polygon UUID is required');
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

	describe('updatePolygon action', () => {
		function createRequestEvent(formFields: Record<string, string>): Record<string, unknown> {
			const formData = new FormData();
			for (const [key, value] of Object.entries(formFields)) {
				formData.append(key, value);
			}
			return {
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'test-uuid' }
			} as Record<string, unknown>;
		}

		test('should update a polygon and return success', async () => {
			const updatedPolygon = {
				type: 'Feature',
				properties: { uuid: 'polygon-uuid', name: null },
				geometry: {
					type: 'Polygon',
					coordinates: [
						[
							[0, 0],
							[2, 0],
							[2, 2],
							[0, 0]
						]
					]
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(updatedPolygon)
			});

			const result = (await actions.updatePolygon(
				createRequestEvent({
					polygonUuid: 'polygon-uuid',
					geojson: JSON.stringify({
						type: 'Polygon',
						coordinates: [
							[
								[0, 0],
								[2, 0],
								[2, 2],
								[0, 0]
							]
						]
					})
				})
			)) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.polygon).toEqual(updatedPolygon);
		});

		test('should fail when polygonUuid is missing', async () => {
			const result = (await actions.updatePolygon(
				createRequestEvent({ geojson: '{"type":"Polygon","coordinates":[]}' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Polygon UUID is required');
		});

		test('should fail when geojson is missing', async () => {
			const result = (await actions.updatePolygon(
				createRequestEvent({ polygonUuid: 'some-uuid' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Polygon geometry is required');
		});

		test('should fail when geojson is invalid', async () => {
			const result = (await actions.updatePolygon(
				createRequestEvent({ polygonUuid: 'some-uuid', geojson: 'not-json' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Invalid GeoJSON');
		});

		test('should call PATCH on the correct endpoint', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({})
			});

			await actions.updatePolygon(
				createRequestEvent({
					polygonUuid: 'my-polygon',
					geojson: JSON.stringify({ type: 'Polygon', coordinates: [] })
				})
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-inquiry-areas/my-polygon/',
				expect.objectContaining({
					method: 'PATCH',
					credentials: 'include',
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);
		});

		test('should forward API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				json: () => Promise.resolve({ detail: 'Invalid polygon geometry' })
			});

			const result = (await actions.updatePolygon(
				createRequestEvent({
					polygonUuid: 'some-uuid',
					geojson: JSON.stringify({ type: 'Polygon', coordinates: [] })
				})
			)) as Record<string, unknown>;

			expect(result.status).toBe(422);
			expect((result.data as Record<string, unknown>).message).toBe('Invalid polygon geometry');
		});
	});

	describe('renamePolygon action', () => {
		function createRequestEvent(formFields: Record<string, string>): Record<string, unknown> {
			const formData = new FormData();
			for (const [key, value] of Object.entries(formFields)) {
				formData.append(key, value);
			}
			return {
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies,
				params: { uuid: 'test-uuid' }
			} as Record<string, unknown>;
		}

		test('should rename a polygon and return success', async () => {
			const renamedPolygon = {
				type: 'Feature',
				properties: { uuid: 'polygon-uuid', name: 'My Area' },
				geometry: { type: 'Polygon', coordinates: [] }
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(renamedPolygon)
			});

			const result = (await actions.renamePolygon(
				createRequestEvent({ polygonUuid: 'polygon-uuid', name: 'My Area' })
			)) as Record<string, unknown>;

			expect(result.success).toBe(true);
			expect(result.polygon).toEqual(renamedPolygon);
		});

		test('should PATCH only the name in the properties', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({})
			});

			await actions.renamePolygon(
				createRequestEvent({ polygonUuid: 'my-polygon', name: 'Renamed' })
			);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-inquiry-areas/my-polygon/',
				expect.objectContaining({
					method: 'PATCH',
					body: JSON.stringify({ type: 'Feature', properties: { name: 'Renamed' } })
				})
			);
		});

		test('should trim whitespace from the name', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({})
			});

			await actions.renamePolygon(
				createRequestEvent({ polygonUuid: 'my-polygon', name: '  Padded  ' })
			);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: JSON.stringify({ type: 'Feature', properties: { name: 'Padded' } })
				})
			);
		});

		test('should fail when polygonUuid is missing', async () => {
			const result = (await actions.renamePolygon(
				createRequestEvent({ name: 'Something' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Polygon UUID is required');
		});

		test('should fail when name is empty or whitespace only', async () => {
			const result = (await actions.renamePolygon(
				createRequestEvent({ polygonUuid: 'some-uuid', name: '   ' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toBe('Name is required');
		});

		test('should forward API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 422,
				json: () => Promise.resolve({ detail: 'Name too long' })
			});

			const result = (await actions.renamePolygon(
				createRequestEvent({ polygonUuid: 'some-uuid', name: 'A very long name' })
			)) as Record<string, unknown>;

			expect(result.status).toBe(422);
			expect((result.data as Record<string, unknown>).message).toBe('Name too long');
		});
	});
});
