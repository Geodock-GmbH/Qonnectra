import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	redirect: (/** @type {number} */ status, /** @type {string} */ location) => {
		const err = /** @type {any} */ (new Error(`Redirect to ${location}`));
		err.status = status;
		err.location = location;
		throw err;
	},
	error: (/** @type {number} */ status, /** @type {string} */ message) => {
		const err = /** @type {any} */ (new Error(message));
		err.status = status;
		return err;
	}
}));

describe('child view +page.server.js', () => {
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
	 * Helper to set up mock responses for the child view load function.
	 *
	 * Fetches in parallel:
	 * node/all, cable/all, cable_label/all, cables/micropipe-summary,
	 * attributes_cable_type, attributes_node_type, attributes_status,
	 * attributes_network_level, attributes_company, flags
	 */
	function setupLoadMocks(
		/** @type {any} */ {
			nodes = [{ id: 'node-1', properties: { uuid: 'node-1' } }],
			cables = [],
			cableLabels = [],
			cableMicropipeConnections = {},
			cableTypes = [],
			nodeTypes = [],
			statuses = [],
			networkLevels = [],
			companies = [],
			flags = [],
			nodeResponseOk = true
		} = {}
	) {
		const responses = {
			'node/all': {
				ok: nodeResponseOk,
				json: () => Promise.resolve(nodes)
			},
			'cable/all': { ok: true, json: () => Promise.resolve(cables) },
			'cable_label/all': { ok: true, json: () => Promise.resolve(cableLabels) },
			'cables/micropipe-summary': {
				ok: true,
				json: () => Promise.resolve(cableMicropipeConnections)
			},
			attributes_cable_type: { ok: true, json: () => Promise.resolve(cableTypes) },
			attributes_node_type: { ok: true, json: () => Promise.resolve(nodeTypes) },
			attributes_status: { ok: true, json: () => Promise.resolve(statuses) },
			attributes_network_level: { ok: true, json: () => Promise.resolve(networkLevels) },
			attributes_company: { ok: true, json: () => Promise.resolve(companies) },
			flags: { ok: true, json: () => Promise.resolve(flags) }
		};

		mockFetch.mockImplementation((/** @type {any} */ url) => {
			for (const [key, response] of Object.entries(responses)) {
				if (url.includes(key)) {
					return Promise.resolve(response);
				}
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
		});
	}

	function callLoad(projectId = 'proj-1', nodeId = 'node-1') {
		return load(
			/** @type {any} */ ({
				fetch: mockFetch,
				cookies: mockCookies,
				params: { projectId, nodeId }
			})
		);
	}

	describe('load function', () => {
		test('should redirect when projectId is missing', async () => {
			await expect(callLoad(undefined, 'node-1')).rejects.toThrow('Redirect to /network-schema');
		});

		test('should redirect when nodeId is missing', async () => {
			await expect(callLoad('proj-1', undefined)).rejects.toThrow('Redirect to /network-schema');
		});

		test('should redirect when node fetch fails', async () => {
			setupLoadMocks({ nodeResponseOk: false });

			await expect(callLoad()).rejects.toThrow('Redirect to /network-schema/proj-1');
		});

		test('should redirect when no parent node found and nodes empty', async () => {
			setupLoadMocks({ nodes: [] });

			await expect(callLoad()).rejects.toThrow('Redirect to /network-schema/proj-1');
		});

		test('should fetch data with correct child_view_for param', async () => {
			setupLoadMocks();

			await callLoad('proj-1', 'node-1');

			const nodeCall = mockFetch.mock.calls.find((/** @type {any} */ c) =>
				c[0].includes('node/all')
			);
			expect(nodeCall[0]).toContain('project=proj-1');
			expect(nodeCall[0]).toContain('child_view_for=node-1');

			const cableCall = mockFetch.mock.calls.find((/** @type {any} */ c) =>
				c[0].includes('cable/all')
			);
			expect(cableCall[0]).toContain('project=proj-1');
			expect(cableCall[0]).toContain('child_view_for=node-1');
		});

		test('should return correct structure with isChildView flag', async () => {
			setupLoadMocks();

			const result = /** @type {any} */ (await callLoad());

			expect(result.isChildView).toBe(true);
			expect(result.parentNodeId).toBe('node-1');
			expect(result.syncStatus).toBeNull();
			expect(result.networkSchemaSettingsConfigured).toBe(true);
			expect(result.excludedNodeTypeIds).toEqual([]);
		});

		test('should pass correct auth headers', async () => {
			setupLoadMocks();

			await callLoad();

			const firstCall = mockFetch.mock.calls[0];
			expect(firstCall[1].headers.Cookie).toBe('api-access-token=mock-token');
			expect(firstCall[1].credentials).toBe('include');
		});

		test('should map attribute data correctly', async () => {
			setupLoadMocks({
				cableTypes: [{ id: 1, cable_type: 'Fiber' }],
				nodeTypes: [{ id: 2, node_type: 'Splice' }],
				statuses: [{ id: 3, status: 'Active' }],
				networkLevels: [{ id: 4, network_level: 'L1' }],
				companies: [{ id: 5, company: 'Acme' }],
				flags: [{ id: 6, flag: 'Priority' }]
			});

			const result = /** @type {any} */ (await callLoad());

			expect(result.cableTypes).toEqual([{ value: 1, label: 'Fiber' }]);
			expect(result.nodeTypes).toEqual([{ value: 2, label: 'Splice' }]);
			expect(result.statuses).toEqual([{ value: 3, label: 'Active' }]);
			expect(result.networkLevels).toEqual([{ value: 4, label: 'L1' }]);
			expect(result.companies).toEqual([{ value: 5, label: 'Acme' }]);
			expect(result.flags).toEqual([{ value: 6, label: 'Priority' }]);
		});

		test('should extract childViewEnabledNodeTypeIds from metadata', async () => {
			setupLoadMocks({
				nodes: {
					metadata: { child_view_enabled_node_type_ids: [10, 20] },
					features: [{ id: 'node-1' }]
				}
			});

			const result = /** @type {any} */ (await callLoad());

			expect(result.childViewEnabledNodeTypeIds).toEqual([10, 20]);
		});
	});

	describe('cable label persistence', () => {
		test('should fetch cable labels and attach labelData to cables', async () => {
			setupLoadMocks({
				cables: [
					{ uuid: 'cable-1', name: 'Cable A' },
					{ uuid: 'cable-2', name: 'Cable B' }
				],
				cableLabels: [
					{
						id: 1,
						cable: 'cable-1',
						offset_x: 50,
						offset_y: -30,
						position: 0.4
					}
				]
			});

			const result = /** @type {any} */ (await callLoad());

			const cable1 = result.cables.find((/** @type {any} */ c) => c.uuid === 'cable-1');
			const cable2 = result.cables.find((/** @type {any} */ c) => c.uuid === 'cable-2');

			expect(cable1.labelData).toEqual({
				id: 1,
				cable: 'cable-1',
				offset_x: 50,
				offset_y: -30,
				position: 0.4
			});
			expect(cable2.labelData).toBeNull();
		});

		test('should handle cable labels with nested cable uuid', async () => {
			setupLoadMocks({
				cables: [{ uuid: 'cable-1', name: 'Cable A' }],
				cableLabels: [
					{
						id: 1,
						cable: { uuid: 'cable-1' },
						offset_x: 10,
						offset_y: 20
					}
				]
			});

			const result = /** @type {any} */ (await callLoad());

			const cable = result.cables.find((/** @type {any} */ c) => c.uuid === 'cable-1');
			expect(cable.labelData).toBeDefined();
			expect(cable.labelData.offset_x).toBe(10);
		});

		test('should set labelData to null when no labels exist', async () => {
			setupLoadMocks({
				cables: [{ uuid: 'cable-1', name: 'Cable A' }],
				cableLabels: []
			});

			const result = /** @type {any} */ (await callLoad());

			expect(result.cables[0].labelData).toBeNull();
		});

		test('should fetch cable_label/all endpoint', async () => {
			setupLoadMocks();

			await callLoad('proj-1', 'node-1');

			const labelCall = mockFetch.mock.calls.find((/** @type {any} */ c) =>
				c[0].includes('cable_label/all')
			);
			expect(labelCall).toBeDefined();
			expect(labelCall[0]).toContain('project=proj-1');
		});

		test('should handle cable_label fetch failure gracefully', async () => {
			mockFetch.mockImplementation((/** @type {any} */ url) => {
				if (url.includes('cable_label/all')) {
					return Promise.resolve({ ok: false, status: 500 });
				}
				if (url.includes('node/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 'node-1', properties: { uuid: 'node-1' } }])
					});
				}
				if (url.includes('cable/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ uuid: 'cable-1' }])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = /** @type {any} */ (await callLoad());

			expect(result.cables[0].labelData).toBeNull();
		});
	});
});
