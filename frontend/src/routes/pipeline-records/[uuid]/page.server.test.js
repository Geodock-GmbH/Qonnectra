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

describe('pipeline record detail +page.server.js', () => {
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
		test('should load record with option lists', async () => {
			const mockRecord = {
				uuid: 'pr-uuid',
				project_name: 'Test Project',
				type_of_work: 'Neubau',
				request_reason: 'Planauskunft',
				organisation: 'ACME',
				name: 'John Doe'
			};

			// record
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockRecord) });
			// type-of-work
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ id: 1, name: 'Neubau' }])
			});
			// request-reasons
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ id: 2, name: 'Planauskunft' }])
			});
			// projects
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve([{ id: 3, project: 'Test Project' }])
			});
			// inquiry areas
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [{ properties: { uuid: 'a1' } }] })
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.record).toEqual(mockRecord);
			expect(result.recordError).toBeNull();
			expect(result.typeOfWorkOptions).toEqual([{ value: 1, label: 'Neubau' }]);
			expect(result.requestReasonOptions).toEqual([{ value: 2, label: 'Planauskunft' }]);
			expect(result.projectOptions).toEqual([{ value: 3, label: 'Test Project' }]);
			expect(result.inquiryAreaCount).toBe(1);
		});

		test('should support projects returned in a paginated envelope', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'pr-uuid' })
			});
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ results: [{ id: 9, project: 'Enveloped' }] })
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.projectOptions).toEqual([{ value: 9, label: 'Enveloped' }]);
		});

		test('should handle record fetch failure', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: () => Promise.resolve({}) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'nonexistent' }
					})
				)
			);

			expect(result.record).toBeNull();
			expect(result.recordError).toBe('Failed to fetch pipeline record');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.record).toBeNull();
			expect(result.recordError).toBe('Error occurred while fetching pipeline record');
		});

		test('should handle failed option responses gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'pr-uuid' })
			});
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

			const result = /** @type {any} */ (
				await load(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.record).toEqual({ uuid: 'pr-uuid' });
			expect(result.typeOfWorkOptions).toEqual([]);
			expect(result.requestReasonOptions).toEqual([]);
			expect(result.projectOptions).toEqual([]);
		});

		test('should pass correct auth headers', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'pr-uuid' })
			});
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ features: [] })
			});

			await load(
				/** @type {any} */ ({
					fetch: mockFetch,
					cookies: mockCookies,
					params: { uuid: 'pr-uuid' }
				})
			);

			mockFetch.mock.calls.forEach((/** @type {any} */ call) => {
				expect(call[1].headers.Cookie).toBe('api-access-token=mock-token');
			});
		});
	});

	describe('updatePipelineRecord action', () => {
		test('should PATCH using the write field names', async () => {
			const updatedRecord = { uuid: 'pr-uuid', organisation: 'ACME' };

			mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updatedRecord) });

			const result = /** @type {any} */ (
				await actions.updatePipelineRecord(
					/** @type {any} */ ({
						request: createMockRequest({
							project: '3',
							type_of_work_value: '1',
							request_reason_value: '2',
							organisation: 'ACME',
							name: 'John Doe',
							tel: '0123',
							mobile: '0171'
						}),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.success).toBe(true);
			expect(result.record).toEqual(updatedRecord);

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-records/pr-uuid/',
				expect.objectContaining({ method: 'PATCH' })
			);
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.project).toBe(3);
			expect(requestBody.type_of_work_value).toBe(1);
			expect(requestBody.request_reason_value).toBe(2);
			expect(requestBody.organisation).toBe('ACME');
			expect(requestBody.name).toBe('John Doe');
			expect(requestBody.tel).toBe('0123');
			expect(requestBody.mobile).toBe('0171');
		});

		test('should null out cleared optional FKs but keep text empty->null', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'pr-uuid' })
			});

			await actions.updatePipelineRecord(
				/** @type {any} */ ({
					request: createMockRequest({
						project: '3',
						type_of_work_value: '',
						request_reason_value: '',
						organisation: '',
						name: '',
						tel: '',
						mobile: ''
					}),
					fetch: mockFetch,
					cookies: mockCookies,
					params: { uuid: 'pr-uuid' }
				})
			);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.project).toBe(3);
			expect(requestBody.type_of_work_value).toBeNull();
			expect(requestBody.request_reason_value).toBeNull();
			expect(requestBody.organisation).toBeNull();
			expect(requestBody.name).toBeNull();
			expect(requestBody.tel).toBeNull();
			expect(requestBody.mobile).toBeNull();
		});

		test('should handle API error with field errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ project: ['This field is required.'] })
			});

			const result = /** @type {any} */ (
				await actions.updatePipelineRecord(
					/** @type {any} */ ({
						request: createMockRequest({ project: '' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toContain('project');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const result = /** @type {any} */ (
				await actions.updatePipelineRecord(
					/** @type {any} */ ({
						request: createMockRequest({ project: '3' }),
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Connection failed');
		});
	});

	describe('deletePipelineRecord action', () => {
		test('should delete record and redirect to the list', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

			await expect(
				actions.deletePipelineRecord(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			).rejects.toEqual({ status: 303, location: '/pipeline-records' });

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-records/pr-uuid/',
				expect.objectContaining({ method: 'DELETE' })
			);
		});

		test('should handle delete API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ detail: 'Not found' })
			});

			const result = /** @type {any} */ (
				await actions.deletePipelineRecord(
					/** @type {any} */ ({
						fetch: mockFetch,
						cookies: mockCookies,
						params: { uuid: 'pr-uuid' }
					})
				)
			);

			expect(result.status).toBe(404);
			expect(result.data.message).toBe('Not found');
		});
	});
});
