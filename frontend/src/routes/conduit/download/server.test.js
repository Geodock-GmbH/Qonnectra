import { beforeEach, describe, expect, test, vi } from 'vitest';

import { GET } from './+server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn((cookies) => {
		const token = cookies?.get('api-access-token');
		return token ? { Cookie: `api-access-token=${token}` } : {};
	})
}));

describe('conduit download +server.js', () => {
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

	test('should return the Excel template on successful download', async () => {
		const blobContent = new Blob(['fake-excel-data'], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers({
				'content-disposition': 'attachment; filename="conduit-template.xlsx"'
			}),
			blob: () => Promise.resolve(blobContent),
			text: () => Promise.resolve('')
		});

		const response = await GET(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch }));

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe(
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);
		expect(response.headers.get('Content-Disposition')).toBe(
			'attachment; filename="conduit-template.xlsx"'
		);
	});

	test('should call the correct API endpoint with auth headers', async () => {
		const blobContent = new Blob(['fake-excel-data']);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			blob: () => Promise.resolve(blobContent),
			text: () => Promise.resolve('')
		});

		await GET(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch }));

		expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/template/conduit/', {
			headers: { Cookie: 'api-access-token=mock-token' }
		});
	});

	test('should use default filename when content-disposition header is missing', async () => {
		const blobContent = new Blob(['fake-excel-data']);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			blob: () => Promise.resolve(blobContent),
			text: () => Promise.resolve('')
		});

		const response = await GET(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch }));

		expect(response.headers.get('Content-Disposition')).toBe(
			'attachment; filename="conduit-template.xlsx"'
		);
	});

	test('should throw HttpError when API response is not ok', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			headers: new Headers(),
			text: () => Promise.resolve('Not found'),
			blob: () => Promise.resolve(new Blob())
		});

		await expect(
			GET(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch }))
		).rejects.toMatchObject({
			status: 404,
			body: { message: 'Failed to download template' }
		});
	});

	test('should throw 500 HttpError on network error', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

		await expect(
			GET(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch }))
		).rejects.toMatchObject({
			status: 500,
			body: { message: 'Failed to download template' }
		});
	});

	test('should re-throw HttpError from error handler', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 502,
			headers: new Headers(),
			text: () => Promise.resolve('Bad gateway'),
			blob: () => Promise.resolve(new Blob())
		});

		await expect(
			GET(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch }))
		).rejects.toMatchObject({
			status: 502
		});
	});

	test('should return blob body in response', async () => {
		const blobContent = new Blob(['test-content']);

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			headers: new Headers(),
			blob: () => Promise.resolve(blobContent),
			text: () => Promise.resolve('')
		});

		const response = await GET(/** @type {any} */ ({ cookies: mockCookies, fetch: mockFetch }));
		const body = await response.blob();

		expect(body.size).toBe(blobContent.size);
	});
});
