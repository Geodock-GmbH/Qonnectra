import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: () => ({ Cookie: 'api-access-token=tok' })
}));

const mockCookies = {} as Cookies;

function makeUrl(query = ''): URL {
	return new URL(`http://localhost:5173/pipeline-records${query}`);
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('pipeline records load', () => {
	test('should load records with default pagination', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					results: [
						{
							uuid: 'rec-1',
							project_name: 'Ausbau Nord',
							type_of_work: 'Tiefbau',
							organisation: 'Firma',
							name: 'Anfrage 1',
							created_at: '2026-01-01'
						}
					],
					page: 1,
					page_size: 50,
					count: 1,
					total_pages: 1
				})
		});

		const result = await load({ fetch: fetchMock, url: makeUrl(), cookies: mockCookies } as never);

		const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(requestedUrl.pathname).toBe('/pipeline-records/');
		expect(requestedUrl.searchParams.get('page')).toBe('1');
		expect(requestedUrl.searchParams.get('page_size')).toBe('50');
		expect(requestedUrl.searchParams.has('search')).toBe(false);

		expect(result.records).toEqual([
			{
				value: 'rec-1',
				project_name: 'Ausbau Nord',
				type_of_work: 'Tiefbau',
				request_reason: '',
				organisation: 'Firma',
				name: 'Anfrage 1',
				created_at: '2026-01-01',
				modified_at: ''
			}
		]);
		expect(result.pagination).toEqual({ page: 1, pageSize: 50, totalCount: 1, totalPages: 1 });
		expect(result.recordsError).toBeNull();
	});

	test('should forward search and pagination parameters', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ results: [] })
		});

		const result = await load({
			fetch: fetchMock,
			url: makeUrl('?search=tiefbau&page=3&page_size=10'),
			cookies: mockCookies
		} as never);

		const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(requestedUrl.searchParams.get('search')).toBe('tiefbau');
		expect(requestedUrl.searchParams.get('page')).toBe('3');
		expect(requestedUrl.searchParams.get('page_size')).toBe('10');
		expect(result.searchTerm).toBe('tiefbau');
	});

	test('should return an error state on a failed response', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await load({ fetch: fetchMock, url: makeUrl(), cookies: mockCookies } as never);

		expect(result.records).toEqual([]);
		expect(result.recordsError).toBe('Failed to fetch pipeline records');
	});

	test('should return an error state on network failures', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

		const result = await load({ fetch: fetchMock, url: makeUrl(), cookies: mockCookies } as never);

		expect(result.records).toEqual([]);
		expect(result.recordsError).toBe('Error occurred while fetching data');
	});
});
