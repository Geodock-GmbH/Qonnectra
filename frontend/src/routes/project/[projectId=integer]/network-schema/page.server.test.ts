import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		return err;
	},
	fail: (status: number, data: Record<string, unknown>) => {
		return { status, data };
	}
}));

describe('+page.server.js', () => {
	let mockFetch: ReturnType<typeof vi.fn>;
	let mockCookies: Record<string, unknown>;

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

	/**
	 * Helper function to create all the mock responses needed by the load function.
	 *
	 * The load function fetches attribute data (cable_type, node_type, status,
	 * network_level, company, flags) and project data (node, cable, cable_label,
	 * cable_micropipe) in parallel, so responses are matched by URL.
	 */
	function setupLoadMocks({
		nodes = [],
		cables = [],
		cableLabels = [],
		cableMicropipeConnections = {},
		cableTypes = [],
		nodeTypes = [],
		statuses = [],
		networkLevels = [],
		companies = [],
		flags = []
	}: {
		nodes?: Record<string, unknown>[] | Record<string, unknown>;
		cables?: Record<string, unknown>[];
		cableLabels?: Record<string, unknown>[];
		cableMicropipeConnections?: Record<string, unknown>;
		cableTypes?: Record<string, unknown>[];
		nodeTypes?: Record<string, unknown>[];
		statuses?: Record<string, unknown>[];
		networkLevels?: Record<string, unknown>[];
		companies?: Record<string, unknown>[];
		flags?: Record<string, unknown>[];
	} = {}) {
		const responses: Record<string, { ok: boolean; json: () => Promise<unknown> }> = {
			attributes_cable_type: { ok: true, json: () => Promise.resolve(cableTypes) },
			attributes_node_type: { ok: true, json: () => Promise.resolve(nodeTypes) },
			attributes_status: { ok: true, json: () => Promise.resolve(statuses) },
			attributes_network_level: { ok: true, json: () => Promise.resolve(networkLevels) },
			attributes_company: { ok: true, json: () => Promise.resolve(companies) },
			flags: { ok: true, json: () => Promise.resolve(flags) },
			'node/all': { ok: true, json: () => Promise.resolve(nodes) },
			'cable/all': { ok: true, json: () => Promise.resolve(cables) },
			'cable_label/all': { ok: true, json: () => Promise.resolve(cableLabels) },
			'cables/micropipe-summary': {
				ok: true,
				json: () => Promise.resolve(cableMicropipeConnections)
			}
		};

		mockFetch.mockImplementation((url: string) => {
			for (const [key, response] of Object.entries(responses)) {
				if (url.includes(key)) {
					return Promise.resolve(response);
				}
			}

			return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
		});
	}

	describe('load function', () => {
		test('should load the project nodes', async () => {
			setupLoadMocks({
				nodes: [{ id: 1, name: 'Node 1', canvas_x: 100, canvas_y: 200 }]
			});

			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies,
				url: new URL('http://localhost'),
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.nodes).toHaveLength(1);
		});

		test.each([true, false])(
			'should pass settings_configured=%s through for the schema warning',
			async (configured) => {
				setupLoadMocks({
					nodes: {
						type: 'FeatureCollection',
						features: [],
						metadata: { settings_configured: configured }
					}
				});

				const result = (await load({
					fetch: mockFetch,
					cookies: mockCookies,
					url: new URL('http://localhost'),
					params: { projectId: '1' }
				} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

				expect(result.networkSchemaSettingsConfigured).toBe(configured);
			}
		);

		test('should handle node fetch failure', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all')) {
					return Promise.resolve({ ok: false, status: 500 });
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			// The implementation throws error(500, 'Failed to fetch nodes') which gets caught
			// and re-thrown, so we expect it to reject
			await expect(
				load({
					fetch: mockFetch,
					cookies: mockCookies,
					url: new URL('http://localhost'),
					params: { projectId: '1' }
				} as unknown as Parameters<typeof load>[0])
			).rejects.toThrow();
		});

		test('should handle complete failure gracefully', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all')) {
					return Promise.reject(new Error('Complete network failure'));
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			// The load function catches errors and returns empty data
			const result = (await load({
				fetch: mockFetch,
				cookies: mockCookies,
				url: new URL('http://localhost'),
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0])) as Record<string, unknown>;

			expect(result.nodes).toEqual([]);
			expect(result.cables).toEqual([]);
		});

		test('should pass correct auth headers', async () => {
			setupLoadMocks();

			await load({
				fetch: mockFetch,
				cookies: mockCookies,
				url: new URL('http://localhost'),
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0]);

			// getAuthHeaders returns a plain object { Cookie: '...' }, not a Headers instance
			const firstCall = mockFetch.mock.calls[0];
			const headers = firstCall[1].headers;

			expect(headers.Cookie).toBe('api-access-token=mock-token');
			expect(firstCall[1].credentials).toBe('include');
		});

		test('should handle missing auth token', async () => {
			(mockCookies.get as ReturnType<typeof vi.fn>).mockReturnValue(null);

			setupLoadMocks();

			await load({
				fetch: mockFetch,
				cookies: mockCookies,
				url: new URL('http://localhost'),
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0]);

			// getAuthHeaders returns {} when no token, so Cookie will be undefined
			const firstCall = mockFetch.mock.calls[0];
			const headers = firstCall[1].headers;

			expect(headers.Cookie).toBeUndefined();
		});

		test('should handle different project and flag parameters', async () => {
			setupLoadMocks();

			await load({
				fetch: mockFetch,
				cookies: mockCookies,
				url: new URL('http://localhost'),
				params: { projectId: '1' }
			} as unknown as Parameters<typeof load>[0]);

			const nodeCall = mockFetch.mock.calls.find((call: unknown[]) =>
				(call[0] as string).includes('node/all')
			);
			expect(nodeCall![0]).toContain('project=1');
		});
	});

	describe('getAuthHeaders', () => {
		test('should create headers with auth token', async () => {
			const { getAuthHeaders } = await import('$lib/utils/getAuthHeaders');

			const headers = getAuthHeaders(
				mockCookies as unknown as Parameters<typeof getAuthHeaders>[0]
			);

			// getAuthHeaders returns a plain object, not a Headers instance
			expect(headers.Cookie).toBe('api-access-token=mock-token');
		});

		test('should create headers without auth token when missing', async () => {
			(mockCookies.get as ReturnType<typeof vi.fn>).mockReturnValue(null);

			const { getAuthHeaders } = await import('$lib/utils/getAuthHeaders');

			const headers = getAuthHeaders(
				mockCookies as unknown as Parameters<typeof getAuthHeaders>[0]
			);

			// When no token, getAuthHeaders returns an empty object
			expect(headers.Cookie).toBeUndefined();
		});
	});
});
