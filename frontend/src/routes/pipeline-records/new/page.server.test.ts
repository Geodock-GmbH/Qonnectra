import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	fail: (status: number, data: Record<string, unknown>) => {
		return { status, data };
	},
	redirect: (status: number, location: string) => {
		throw { status, location };
	}
}));

describe('pipeline record create +page.server.js', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: { get: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn((name: string) => {
				if (name === 'api-access-token') return 'mock-token';
				return null;
			})
		};

		mockFetch = vi.fn();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	function createMockFormData(data: Record<string, unknown>) {
		const map = new Map(Object.entries(data));
		return {
			get: (key: string) => map.get(key) ?? null
		};
	}

	function createMockRequest(formDataObj: Record<string, unknown>) {
		return {
			formData: () => Promise.resolve(createMockFormData(formDataObj))
		} as unknown as Request;
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

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.typeOfWorkOptions).toEqual([{ value: 1, label: 'Neubau' }]);
			expect(result.requestReasonOptions).toEqual([{ value: 2, label: 'Planauskunft' }]);
			expect(result.projectOptions).toEqual([{ value: 3, label: 'Test Project' }]);
		});
	});

	describe('createPipelineRecord action', () => {
		test('should POST using the write field names and redirect to the created record', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'new-uuid' })
			});

			await expect(
				actions.createPipelineRecord({
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
				} as unknown as Parameters<typeof actions.createPipelineRecord>[0])
			).rejects.toEqual({ status: 303, location: '/pipeline-records/new-uuid' });

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
				actions.createPipelineRecord({
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
				} as unknown as Parameters<typeof actions.createPipelineRecord>[0])
			).rejects.toEqual({ status: 303, location: '/pipeline-records/new-uuid' });

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

			const result = (await actions.createPipelineRecord({
				request: createMockRequest({ project: '' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.createPipelineRecord>[0])) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toContain('project');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const result = (await actions.createPipelineRecord({
				request: createMockRequest({ project: '3' }),
				fetch: mockFetch,
				cookies: mockCookies
			} as unknown as Parameters<typeof actions.createPipelineRecord>[0])) as Record<
				string,
				unknown
			>;

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).message).toBe('Connection failed');
		});
	});
});
