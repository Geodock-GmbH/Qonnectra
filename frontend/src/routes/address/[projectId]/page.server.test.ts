import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

describe('address list +page.server.js', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
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
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	function setupLoadMocks({
		addressesResponse = {
			results: [] as Record<string, unknown>[],
			page: 1,
			page_size: 50,
			count: 0,
			total_pages: 0
		},
		statusDevelopments = [] as Record<string, unknown>[],
		flags = [] as Record<string, unknown>[],
		addressesOk = true
	} = {}) {
		mockFetch.mockResolvedValueOnce({
			ok: addressesOk,
			status: addressesOk ? 200 : 500,
			json: () => Promise.resolve(addressesResponse)
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(statusDevelopments)
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(flags)
		});
	}

	describe('load function', () => {
		test('should return empty data when projectId is missing', async () => {
			const result = (await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: {}
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.addresses).toEqual([]);
			expect(result.pagination).toEqual({ page: 1, pageSize: 50, totalCount: 0, totalPages: 0 });
			expect(result.addressesError).toBeNull();
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('should fetch addresses successfully with projectId', async () => {
			const mockAddresses = [
				{
					uuid: 'addr-uuid-1',
					id_address: 'ADDR-001',
					street: 'Main St',
					housenumber: 42,
					house_number_suffix: 'a',
					zip_code: '12345',
					city: 'Berlin',
					district: 'Mitte',
					status_development: 'Planned',
					flag: 'Priority'
				}
			];

			setupLoadMocks({
				addressesResponse: {
					results: mockAddresses,
					page: 1,
					page_size: 50,
					count: 1,
					total_pages: 1
				},
				statusDevelopments: [{ id: 1, status_development: 'Planned' }],
				flags: [{ id: 1, flag: 'Priority' }]
			});

			const result = (await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.addresses).toHaveLength(1);
			expect((result.addresses as Record<string, unknown>[])[0].value).toBe('addr-uuid-1');
			expect((result.addresses as Record<string, unknown>[])[0].street).toBe('Main St');
			expect((result.addresses as Record<string, unknown>[])[0].housenumber).toBe(42);
			expect((result.pagination as Record<string, unknown>).totalCount).toBe(1);
			expect(result.addressesError).toBeNull();
			expect(result.statusDevelopments).toEqual([{ value: 1, label: 'Planned' }]);
			expect(result.flags).toEqual([{ value: 1, label: 'Priority' }]);
		});

		test('should handle search parameter', async () => {
			setupLoadMocks();

			await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1?search=Main'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0]);

			const firstCall = mockFetch.mock.calls[0][0];
			expect(firstCall).toContain('search=Main');
		});

		test('should handle pagination parameters', async () => {
			setupLoadMocks();

			await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1?page=3&page_size=25'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0]);

			const firstCall = mockFetch.mock.calls[0][0];
			expect(firstCall).toContain('page=3');
			expect(firstCall).toContain('page_size=25');
		});

		test('should handle addresses fetch failure', async () => {
			setupLoadMocks({ addressesOk: false });

			const result = (await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.addresses).toEqual([]);
			expect(result.addressesError).toBe('Failed to fetch addresses');
		});

		test('should handle network error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'));

			const result = (await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.addresses).toEqual([]);
			expect(result.addressesError).toBe('Error occurred while fetching data');
		});

		test('should pass correct auth headers', async () => {
			setupLoadMocks();

			await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0]);

			mockFetch.mock.calls.forEach((call: unknown[]) => {
				expect(
					(call[1] as Record<string, unknown> & { headers: Record<string, string> }).headers.Cookie
				).toBe('api-access-token=mock-token');
			});
		});

		test('should map address data correctly with fallback empty strings', async () => {
			setupLoadMocks({
				addressesResponse: {
					results: [{ uuid: 'uuid-1' }],
					page: 1,
					page_size: 50,
					count: 1,
					total_pages: 1
				}
			});

			const result = (await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			const addr = (result.addresses as Record<string, unknown>[])[0];
			expect(addr.value).toBe('uuid-1');
			expect(addr.id_address).toBe('');
			expect(addr.street).toBe('');
			expect(addr.city).toBe('');
		});

		test('should use default pagination when not provided in URL', async () => {
			setupLoadMocks();

			await load({
				fetch: mockFetch,
				url: new URL('http://localhost/address/1'),
				depends: vi.fn(),
				cookies: mockCookies,
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0]);

			const firstCall = mockFetch.mock.calls[0][0];
			expect(firstCall).toContain('page=1');
			expect(firstCall).toContain('page_size=50');
		});
	});
});
