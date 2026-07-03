import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

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
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('load function', () => {
		test('should return recordExists true when pipeline record is found', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

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
		});

		test('should return recordExists false when pipeline record is not found', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

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

		test('should call the pipeline-records API with the correct uuid', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true });

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
		});
	});
});
