import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

// Mock the environment variable
vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

// Mock SvelteKit fail helper
vi.mock('@sveltejs/kit', () => ({
	fail: (/** @type {number} */ status, /** @type {any} */ data) => {
		return { status, data };
	}
}));

describe('+page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = {
			get: vi.fn((name) => {
				if (name === 'api-access-token') {
					return 'mock-token';
				}
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
	 * @param {any} [options.pipesResponse]
	 * @param {any[]} [options.conduitTypes]
	 * @param {any[]} [options.statuses]
	 * @param {any[]} [options.networkLevels]
	 * @param {any[]} [options.companies]
	 * @param {any[]} [options.flags]
	 * @param {boolean} [options.pipesOk]
	 */
	function setupLoadMocks({
		pipesResponse = { results: [], page: 1, page_size: 50, count: 0, total_pages: 0 },
		conduitTypes = [],
		statuses = [],
		networkLevels = [],
		companies = [],
		flags = [],
		pipesOk = true
	} = {}) {
		// pipes response
		mockFetch.mockResolvedValueOnce({
			ok: pipesOk,
			status: pipesOk ? 200 : 500,
			json: () => Promise.resolve(pipesResponse)
		});

		// conduit types
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(conduitTypes)
		});

		// statuses
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(statuses)
		});

		// network levels
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(networkLevels)
		});

		// companies
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(companies)
		});

		// flags
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(flags)
		});
	}

	describe('load function', () => {
		test('should return empty data when projectId is missing', async () => {
			const result = /** @type {any} */ (await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: {}
			})));

			expect(result.pipes).toEqual([]);
			expect(result.pagination).toEqual({ page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });
			expect(result.pipesError).toBeNull();
			expect(result.projectId).toBeUndefined();
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should fetch conduits successfully with projectId', async () => {
			const mockPipes = [
				{
					uuid: 'uuid-1',
					name: 'Conduit 1',
					conduit_type: 'Type A',
					outer_conduit: 'Outer 1',
					status: 'Active',
					network_level: 'Level 1',
					owner: 'Owner 1',
					constructor: 'Constructor 1',
					manufacturer: 'Manufacturer 1',
					date: '2024-01-01',
					flag: 'Flag 1'
				}
			];

			setupLoadMocks({
				pipesResponse: {
					results: mockPipes,
					page: 1,
					page_size: 50,
					count: 1,
					total_pages: 1
				},
				conduitTypes: [{ id: 1, conduit_type: 'Type A' }],
				statuses: [{ id: 1, status: 'Active' }],
				networkLevels: [{ id: 1, network_level: 'Level 1' }],
				companies: [{ id: 1, company: 'Company 1' }],
				flags: [{ id: 1, flag: 'Flag 1' }]
			});

			const result = /** @type {any} */ (await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			})));

			expect(result.pipes).toHaveLength(1);
			expect(result.pipes[0].value).toBe('uuid-1');
			expect(result.pipes[0].name).toBe('Conduit 1');
			expect(result.pagination.totalCount).toBe(1);
			expect(result.pipesError).toBeNull();
			expect(result.conduitTypes).toEqual([{ value: 1, label: 'Type A' }]);
			expect(result.statuses).toEqual([{ value: 1, label: 'Active' }]);
		});

		test('should handle search parameter', async () => {
			setupLoadMocks();

			await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1?search=test'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			}));

			const firstCall = mockFetch.mock.calls[0][0];
			expect(firstCall).toContain('search=test');
		});

		test('should handle pagination parameters', async () => {
			setupLoadMocks();

			await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1?page=2&page_size=25'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			}));

			const firstCall = mockFetch.mock.calls[0][0];
			expect(firstCall).toContain('page=2');
			expect(firstCall).toContain('page_size=25');
		});

		test('should handle pipes fetch failure', async () => {
			setupLoadMocks({ pipesOk: false });

			const result = /** @type {any} */ (await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			})));

			expect(result.pipes).toEqual([]);
			expect(result.pipesError).toBe('Failed to fetch conduits');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = /** @type {any} */ (await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			})));

			expect(result.pipes).toEqual([]);
			expect(result.pipesError).toBe('Error occurred while fetching data');
		});

		test('should pass correct auth headers', async () => {
			setupLoadMocks();

			await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			}));

			const firstCallHeaders = mockFetch.mock.calls[0][1].headers;
			expect(firstCallHeaders.Cookie).toBe('api-access-token=mock-token');
		});
	});

	describe('getConduit action', () => {
		test('should get conduit successfully', async () => {
			const mockConduit = {
				uuid: 'test-uuid',
				name: 'Test Conduit',
				conduit_type: 'Type A'
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockConduit)
			});

			const result = /** @type {any} */ (await actions.getConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.conduit).toEqual(mockConduit);
			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/conduit/test-uuid/',
				expect.objectContaining({
					method: 'GET',
					credentials: 'include'
				})
			);
		});

		test('should return error when uuid is missing', async () => {
			const result = /** @type {any} */ (await actions.getConduit(/** @type {any} */ ({
				request: createMockRequest({}),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.error).toBe('Missing required parameter: uuid');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				text: () => Promise.resolve('Conduit not found')
			});

			const result = /** @type {any} */ (await actions.getConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'nonexistent-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(404);
			expect(result.data.error).toBe('Conduit not found');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network failure'));

			const result = /** @type {any} */ (await actions.getConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(500);
			expect(result.data.error).toBe('Internal server error');
		});
	});

	describe('updateConduit action', () => {
		test('should update conduit successfully', async () => {
			const updatedConduit = {
				uuid: 'test-uuid',
				name: 'Updated Conduit',
				conduit_type_id: 1
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(updatedConduit)
			});

			const result = /** @type {any} */ (await actions.updateConduit(/** @type {any} */ ({
				request: createMockRequest({
					uuid: 'test-uuid',
					conduit_name: 'Updated Conduit',
					conduit_type_id: '1',
					status_id: '2'
				}),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.success).toBe(true);
			expect(result.message).toBe('Conduit updated successfully');
			expect(result.conduit).toEqual(updatedConduit);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.name).toBe('Updated Conduit');
			expect(requestBody.conduit_type_id).toBe(1);
			expect(requestBody.status_id).toBe(2);
		});

		test('should return error when uuid is missing', async () => {
			const result = /** @type {any} */ (await actions.updateConduit(/** @type {any} */ ({
				request: createMockRequest({ conduit_name: 'Test' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Conduit ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid conduit type' })
			});

			const result = /** @type {any} */ (await actions.updateConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid', conduit_name: 'Test' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid conduit type');
		});

		test('should handle API error without detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: () => Promise.resolve({})
			});

			const result = /** @type {any} */ (await actions.updateConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid', conduit_name: 'Test' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Failed to update conduit');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const result = /** @type {any} */ (await actions.updateConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid', conduit_name: 'Test' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Connection failed');
		});

		test('should handle all optional fields', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'test-uuid' })
			});

			await actions.updateConduit(/** @type {any} */ ({
				request: createMockRequest({
					uuid: 'test-uuid',
					conduit_name: 'Test',
					conduit_type_id: '1',
					outer_conduit: 'outer-uuid',
					status_id: '2',
					network_level_id: '3',
					owner_id: '4',
					constructor_id: '5',
					manufacturer_id: '6',
					flag_id: '7',
					date: '2024-01-01'
				}),
				fetch: mockFetch,
				cookies: mockCookies
			}));

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody).toEqual({
				name: 'Test',
				conduit_type_id: 1,
				outer_conduit: 'outer-uuid',
				status_id: 2,
				network_level_id: 3,
				owner_id: 4,
				constructor_id: 5,
				manufacturer_id: 6,
				flag_id: 7,
				date: '2024-01-01'
			});
		});
	});

	describe('deleteConduit action', () => {
		test('should delete conduit successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true
			});

			const result = /** @type {any} */ (await actions.deleteConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.success).toBe(true);
			expect(result.message).toBe('Conduit deleted successfully');
			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8000/conduit/test-uuid/',
				expect.objectContaining({
					method: 'DELETE',
					credentials: 'include'
				})
			);
		});

		test('should return error when uuid is missing', async () => {
			const result = /** @type {any} */ (await actions.deleteConduit(/** @type {any} */ ({
				request: createMockRequest({}),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Conduit ID is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle API error with detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ detail: 'Conduit not found' })
			});

			const result = /** @type {any} */ (await actions.deleteConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'nonexistent-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(404);
			expect(result.data.message).toBe('Conduit not found');
		});

		test('should handle API error without detail', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: () => Promise.resolve({})
			});

			const result = /** @type {any} */ (await actions.deleteConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Failed to delete conduit');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (await actions.deleteConduit(/** @type {any} */ ({
				request: createMockRequest({ uuid: 'test-uuid' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network error');
		});
	});

	describe('createConduit action', () => {
		test('should create conduit successfully', async () => {
			const newConduit = {
				uuid: 'new-uuid',
				name: 'New Conduit'
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(newConduit)
			});

			const result = /** @type {any} */ (await actions.createConduit(/** @type {any} */ ({
				request: createMockRequest({
					name: 'New Conduit',
					project_id: '1',
					conduit_type_id: '1'
				}),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.success).toBe(true);
			expect(result.message).toBe('Conduit created successfully');
			expect(result.conduit).toEqual(newConduit);
		});

		test('should return error when name is missing', async () => {
			const result = /** @type {any} */ (await actions.createConduit(/** @type {any} */ ({
				request: createMockRequest({ project_id: '1' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Conduit name is required');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should handle all optional fields', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ uuid: 'new-uuid' })
			});

			await actions.createConduit(/** @type {any} */ ({
				request: createMockRequest({
					name: 'Test',
					project_id: '1',
					conduit_type_id: '2',
					outer_conduit: 'outer-uuid',
					status_id: '3',
					network_level_id: '4',
					owner_id: '5',
					constructor_id: '6',
					manufacturer_id: '7',
					flag_id: '8',
					date: '2024-01-01'
				}),
				fetch: mockFetch,
				cookies: mockCookies
			}));

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody).toEqual({
				name: 'Test',
				project_id: 1,
				conduit_type_id: 2,
				outer_conduit: 'outer-uuid',
				status_id: 3,
				network_level_id: 4,
				owner_id: 5,
				constructor_id: 6,
				manufacturer_id: 7,
				flag_id: 8,
				date: '2024-01-01'
			});
		});

		test('should handle API error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () => Promise.resolve({ detail: 'Invalid data' })
			});

			const result = /** @type {any} */ (await actions.createConduit(/** @type {any} */ ({
				request: createMockRequest({ name: 'Test' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.message).toBe('Invalid data');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = /** @type {any} */ (await actions.createConduit(/** @type {any} */ ({
				request: createMockRequest({ name: 'Test' }),
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(500);
			expect(result.data.message).toBe('Network error');
		});
	});

	describe('uploadConduits action', () => {
		test('should upload file successfully', async () => {
			const mockFile = new File(['test content'], 'conduits.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});

			const formData = {
				get: (/** @type {string} */ key) => {
					if (key === 'file') return mockFile;
					return null;
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						created_count: 5,
						message: 'Successfully imported 5 conduits',
						warnings: []
					})
			});

			const result = /** @type {any} */ (await actions.uploadConduits(/** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.uploadSuccess).toBe(true);
			expect(result.createdCount).toBe(5);
			expect(result.message).toBe('Successfully imported 5 conduits');
		});

		test('should return error when no file is uploaded', async () => {
			const formData = {
				get: () => null
			};

			const result = /** @type {any} */ (await actions.uploadConduits(/** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.uploadError).toBe(true);
			expect(result.data.message).toBe('No file uploaded or invalid file');
		});

		test('should return error for invalid file format', async () => {
			const mockFile = new File(['test content'], 'conduits.csv', {
				type: 'text/csv'
			});

			const formData = {
				get: (/** @type {string} */ key) => {
					if (key === 'file') return mockFile;
					return null;
				}
			};

			const result = /** @type {any} */ (await actions.uploadConduits(/** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.uploadError).toBe(true);
			expect(result.data.message).toBe('Invalid file format. Please upload an .xlsx file.');
		});

		test('should return error for file too large', async () => {
			const largeContent = new ArrayBuffer(11 * 1024 * 1024); // 11MB
			const mockFile = new File([largeContent], 'conduits.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});

			const formData = {
				get: (/** @type {string} */ key) => {
					if (key === 'file') return mockFile;
					return null;
				}
			};

			const result = /** @type {any} */ (await actions.uploadConduits(/** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.uploadError).toBe(true);
			expect(result.data.message).toBe('File too large. Maximum size is 10MB.');
		});

		test('should handle API error with warnings', async () => {
			const mockFile = new File(['test content'], 'conduits.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});

			const formData = {
				get: (/** @type {string} */ key) => {
					if (key === 'file') return mockFile;
					return null;
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: () =>
					Promise.resolve({
						error: 'Some rows failed',
						errors: ['Row 1: Invalid data'],
						warnings: ['Row 2: Duplicate entry']
					})
			});

			const result = /** @type {any} */ (await actions.uploadConduits(/** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(400);
			expect(result.data.uploadError).toBe(true);
			expect(result.data.message).toBe('Some rows failed');
			expect(result.data.errors).toContain('Row 1: Invalid data');
			expect(result.data.warnings).toContain('Row 2: Duplicate entry');
		});

		test('should handle network error', async () => {
			const mockFile = new File(['test content'], 'conduits.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});

			const formData = {
				get: (/** @type {string} */ key) => {
					if (key === 'file') return mockFile;
					return null;
				}
			};

			mockFetch.mockRejectedValueOnce(new Error('Network failure'));

			const result = /** @type {any} */ (await actions.uploadConduits(/** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.status).toBe(500);
			expect(result.data.uploadError).toBe(true);
			expect(result.data.message).toBe('Internal server error during file upload');
		});

		test('should accept .xlsx file by extension', async () => {
			const mockFile = new File(['test content'], 'conduits.xlsx', {
				type: '' // Empty type, but valid extension
			});

			const formData = {
				get: (/** @type {string} */ key) => {
					if (key === 'file') return mockFile;
					return null;
				}
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ created_count: 1, message: 'OK', warnings: [] })
			});

			const result = /** @type {any} */ (await actions.uploadConduits(/** @type {any} */ ({
				request: { formData: () => Promise.resolve(formData) },
				fetch: mockFetch,
				cookies: mockCookies
			})));

			expect(result.uploadSuccess).toBe(true);
		});
	});

	describe('auth headers', () => {
		test('should include auth headers in all API calls', async () => {
			setupLoadMocks();

			await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			}));

			// All calls should include auth headers
			mockFetch.mock.calls.forEach((/** @type {any} */ call) => {
				expect(call[1].headers.Cookie).toBe('api-access-token=mock-token');
			});
		});

		test('should handle missing auth token', async () => {
			mockCookies.get.mockReturnValue(null);
			setupLoadMocks();

			await load(/** @type {any} */ ({
				fetch: mockFetch,
				url: new URL('http://localhost/conduit/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			}));

			// Should not have Cookie header when token is missing
			mockFetch.mock.calls.forEach((/** @type {any} */ call) => {
				expect(call[1].headers.Cookie).toBeUndefined();
			});
		});
	});
});
