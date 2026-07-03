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

describe('pipeline record create +page.server.js', () => {
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
		test('should load option lists only', async () => {
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

			const result = /** @type {any} */ (
				await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }))
			);

			expect(result.typeOfWorkOptions).toEqual([{ value: 1, label: 'Neubau' }]);
			expect(result.requestReasonOptions).toEqual([{ value: 2, label: 'Planauskunft' }]);
			expect(result.projectOptions).toEqual([{ value: 3, label: 'Test Project' }]);
		});
	});

	describe('createPipelineRecord action', () => {
		test('should POST using the write field names and redirect to the list', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'new-uuid' })
			});

			await expect(
				actions.createPipelineRecord(
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
						cookies: mockCookies
					})
				)
			).rejects.toEqual({ status: 303, location: '/pipeline-records' });

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/pipeline-records/',
				expect.objectContaining({ method: 'POST' })
			);
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.project).toBe(3);
			expect(requestBody.type_of_work_value).toBe(1);
			expect(requestBody.request_reason_value).toBe(2);
			expect(requestBody.organisation).toBe('ACME');
		});

		test('should omit optional FKs when not provided', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'new-uuid' })
			});

			await expect(
				actions.createPipelineRecord(
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
						cookies: mockCookies
					})
				)
			).rejects.toEqual({ status: 303, location: '/pipeline-records' });

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.project).toBe(3);
			expect(requestBody.type_of_work_value).toBeNull();
			expect(requestBody.request_reason_value).toBeNull();
		});

		test('should handle validation error without redirecting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ project: ['This field is required.'] })
			});

			const result = /** @type {any} */ (
				await actions.createPipelineRecord(
					/** @type {any} */ ({
						request: createMockRequest({ project: '' }),
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(400);
			expect(result.data.message).toContain('project');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const result = /** @type {any} */ (
				await actions.createPipelineRecord(
					/** @type {any} */ ({
						request: createMockRequest({ project: '3' }),
						fetch: mockFetch,
						cookies: mockCookies
					})
				)
			);

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Connection failed');
		});
	});
});
