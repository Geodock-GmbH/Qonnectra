import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

describe('admin logs +page.server.js', () => {
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

	/**
	 * @param {object} [options]
	 * @param {any} [options.logsResponse]
	 * @param {any[]} [options.projectsResponse]
	 * @param {boolean} [options.logsOk]
	 * @param {boolean} [options.projectsOk]
	 */
	function setupMocks({
		logsResponse = { results: [], count: 0, next: null, previous: null },
		projectsResponse = [],
		logsOk = true,
		projectsOk = true
	} = {}) {
		mockFetch.mockResolvedValueOnce({
			ok: projectsOk,
			status: projectsOk ? 200 : 500,
			json: () => Promise.resolve(projectsResponse)
		});
		mockFetch.mockResolvedValueOnce({
			ok: logsOk,
			status: logsOk ? 200 : 500,
			json: () => Promise.resolve(logsResponse)
		});
	}

	/**
	 * @param {string} [urlString]
	 * @param {boolean} [isAdmin]
	 */
	function createLoadArgs(urlString = 'http://localhost/admin/logs', isAdmin = true) {
		return /** @type {any} */ ({
			fetch: mockFetch,
			cookies: mockCookies,
			url: new URL(urlString),
			locals: { user: { isAdmin } }
		});
	}

	describe('access control', () => {
		test('should redirect non-admin users to /map', async () => {
			await expect(load(createLoadArgs('http://localhost/admin/logs', false))).rejects.toEqual(
				expect.objectContaining({ status: 303, location: '/map' })
			);

			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should redirect when user is undefined', async () => {
			const args = /** @type {any} */ ({
				fetch: mockFetch,
				cookies: mockCookies,
				url: new URL('http://localhost/admin/logs'),
				locals: {}
			});

			await expect(load(args)).rejects.toEqual(
				expect.objectContaining({ status: 303, location: '/map' })
			);
		});
	});

	describe('successful data loading', () => {
		test('should return logs and projects on success', async () => {
			const mockLogs = [
				{
					uuid: 'log-1',
					level: 'ERROR',
					source: 'backend',
					message: 'Something failed',
					timestamp: '2026-01-15T10:00:00Z',
					username: 'admin',
					project: { project: 'Project A' }
				}
			];

			setupMocks({
				logsResponse: { results: mockLogs, count: 1, next: null, previous: null },
				projectsResponse: [{ id: 1, project: 'Project A' }]
			});

			const result = await load(createLoadArgs());

			expect(result.logs).toHaveLength(1);
			expect(result.logs[0].level).toBe('ERROR');
			expect(result.logs[0].message).toBe('Something failed');
			expect(result.count).toBe(1);
			expect(result.projects).toHaveLength(1);
			expect(result.next).toBeNull();
			expect(result.previous).toBeNull();
		});

		test('should pass default filters when no query params', async () => {
			setupMocks();

			const result = await load(createLoadArgs());

			expect(result.filters).toEqual({
				level: '',
				source: '',
				search: '',
				dateFrom: '',
				dateTo: '',
				project: '',
				page: '1'
			});
		});

		test('should handle projects fetch failure gracefully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: () => Promise.resolve([])
			});
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ results: [], count: 0, next: null, previous: null })
			});

			const result = await load(createLoadArgs());

			expect(result.logs).toEqual([]);
			expect(result.projects).toEqual([]);
		});
	});

	describe('filter parameters', () => {
		test('should pass all filter parameters to API', async () => {
			setupMocks();

			await load(
				createLoadArgs(
					'http://localhost/admin/logs?level=ERROR&source=backend&search=test&date_from=2026-01-01&date_to=2026-01-31&project=1&page=2'
				)
			);

			const logsCall = mockFetch.mock.calls[1][0];
			expect(logsCall).toContain('level=ERROR');
			expect(logsCall).toContain('source=backend');
			expect(logsCall).toContain('search=test');
			expect(logsCall).toContain('date_from=2026-01-01');
			expect(logsCall).toContain('date_to=2026-01-31');
			expect(logsCall).toContain('project=1');
			expect(logsCall).toContain('page=2');
		});

		test('should return filters in response', async () => {
			setupMocks();

			const result = await load(
				createLoadArgs(
					'http://localhost/admin/logs?level=WARNING&source=frontend&search=timeout&page=3'
				)
			);

			expect(result.filters).toEqual({
				level: 'WARNING',
				source: 'frontend',
				search: 'timeout',
				dateFrom: '',
				dateTo: '',
				project: '',
				page: '3'
			});
		});

		test('should omit empty filter params from API URL', async () => {
			setupMocks();

			await load(createLoadArgs('http://localhost/admin/logs?level=ERROR'));

			const logsCall = mockFetch.mock.calls[1][0];
			expect(logsCall).toContain('level=ERROR');
			expect(logsCall).not.toContain('source=');
			expect(logsCall).not.toContain('search=');
		});
	});

	describe('error handling', () => {
		test('should return empty data when logs fetch fails', async () => {
			setupMocks({ logsOk: false });

			const result = await load(createLoadArgs());

			expect(result.logs).toEqual([]);
			expect(result.count).toBe(0);
			expect(result.next).toBeNull();
			expect(result.previous).toBeNull();
			expect(result.projects).toEqual([]);
		});

		test('should return empty data on network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = await load(createLoadArgs());

			expect(result.logs).toEqual([]);
			expect(result.count).toBe(0);
			expect(result.projects).toEqual([]);
		});
	});

	describe('authentication', () => {
		test('should pass correct auth headers', async () => {
			setupMocks();

			await load(createLoadArgs());

			mockFetch.mock.calls.forEach((/** @type {any} */ call) => {
				expect(call[1].headers.Cookie).toBe('api-access-token=mock-token');
				expect(call[1].credentials).toBe('include');
			});
		});
	});
});
