import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	redirect: (status: number, location: string) => {
		const err = new Error(`Redirect to ${location}`) as Error & {
			status: number;
			location: string;
		};
		err.status = status;
		err.location = location;
		throw err;
	},
	error: (status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		return err;
	}
}));

describe('child view +page.server.js', () => {
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

	/**
	 * Helper to set up mock responses for the child view load function.
	 *
	 * Fetches in parallel:
	 * node/all, cable/all, cable_label/all, cables/micropipe-summary,
	 * attributes_cable_type, attributes_node_type, attributes_status,
	 * attributes_network_level, attributes_company, flags
	 */
	function setupLoadMocks({
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
	}: {
		nodes?: unknown;
		cables?: unknown[];
		cableLabels?: unknown[];
		cableMicropipeConnections?: Record<string, unknown>;
		cableTypes?: unknown[];
		nodeTypes?: unknown[];
		statuses?: unknown[];
		networkLevels?: unknown[];
		companies?: unknown[];
		flags?: unknown[];
		nodeResponseOk?: boolean;
	} = {}) {
		const responses: Record<string, { ok: boolean; json: () => Promise<unknown> }> = {
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

		mockFetch.mockImplementation((url: string) => {
			for (const [key, response] of Object.entries(responses)) {
				if (url.includes(key)) {
					return Promise.resolve(response);
				}
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
		});
	}

	function callLoad(projectId = 'proj-1', nodeId = 'node-1') {
		return load({
			fetch: mockFetch,
			cookies: mockCookies,
			params: { projectId, nodeId }
		} as Record<string, unknown>);
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

			const nodeCall = mockFetch.mock.calls.find((c: unknown[]) =>
				(c[0] as string).includes('node/all')
			);
			expect(nodeCall[0]).toContain('project=proj-1');
			expect(nodeCall[0]).toContain('child_view_for=node-1');

			const cableCall = mockFetch.mock.calls.find((c: unknown[]) =>
				(c[0] as string).includes('cable/all')
			);
			expect(cableCall[0]).toContain('project=proj-1');
			expect(cableCall[0]).toContain('child_view_for=node-1');
		});

		test('should return correct structure with isChildView flag', async () => {
			setupLoadMocks();

			const result = (await callLoad()) as Record<string, unknown>;

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

			const result = (await callLoad()) as Record<string, unknown>;

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

			const result = (await callLoad()) as Record<string, unknown>;

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

			const result = (await callLoad()) as Record<string, unknown>;

			const cable1 = (result.cables as Record<string, unknown>[]).find(
				(c: Record<string, unknown>) => c.uuid === 'cable-1'
			);
			const cable2 = (result.cables as Record<string, unknown>[]).find(
				(c: Record<string, unknown>) => c.uuid === 'cable-2'
			);

			expect(cable1!.labelData).toEqual({
				id: 1,
				cable: 'cable-1',
				offset_x: 50,
				offset_y: -30,
				position: 0.4
			});
			expect(cable2!.labelData).toBeNull();
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

			const result = (await callLoad()) as Record<string, unknown>;

			const cable = (result.cables as Record<string, unknown>[]).find(
				(c: Record<string, unknown>) => c.uuid === 'cable-1'
			);
			expect(cable!.labelData).toBeDefined();
			expect((cable!.labelData as Record<string, unknown>).offset_x).toBe(10);
		});

		test('should set labelData to null when no labels exist', async () => {
			setupLoadMocks({
				cables: [{ uuid: 'cable-1', name: 'Cable A' }],
				cableLabels: []
			});

			const result = (await callLoad()) as Record<string, unknown>;

			expect((result.cables as Record<string, unknown>[])[0].labelData).toBeNull();
		});

		test('should fetch cable_label/all endpoint', async () => {
			setupLoadMocks();

			await callLoad('proj-1', 'node-1');

			const labelCall = mockFetch.mock.calls.find((c: unknown[]) =>
				(c[0] as string).includes('cable_label/all')
			);
			expect(labelCall).toBeDefined();
			expect(labelCall[0]).toContain('project=proj-1');
		});

		test('should handle cable_label fetch failure gracefully', async () => {
			mockFetch.mockImplementation((url: string) => {
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

			const result = (await callLoad()) as Record<string, unknown>;

			expect((result.cables as Record<string, unknown>[])[0].labelData).toBeNull();
		});
	});

	describe('degraded API responses', () => {
		/**
		 * Builds a fetch mock where node/all always succeeds but a chosen set of
		 * endpoint keys respond with a non-ok status, exercising each `.ok` guard.
		 */
		function setupWithFailures(failing: string[], payloads: Record<string, unknown> = {}) {
			mockFetch.mockImplementation((url: string) => {
				const failed = failing.find((key) => url.includes(key));
				if (failed) {
					return Promise.resolve({ ok: false, status: 500 });
				}
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () =>
							Promise.resolve(
								payloads['node/all'] ?? [{ id: 'node-1', properties: { uuid: 'node-1' } }]
							)
					});
				}
				for (const [key, value] of Object.entries(payloads)) {
					if (url.includes(key)) {
						return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
					}
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});
		}

		test('should default cables to empty array when cable fetch fails', async () => {
			setupWithFailures(['cable/all']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.cables).toEqual([]);
		});

		test('should default cableMicropipeConnections to empty object when micropipe fetch fails', async () => {
			setupWithFailures(['cables/micropipe-summary']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.cableMicropipeConnections).toEqual({});
		});

		test('should leave cableTypes empty when attribute fetch fails', async () => {
			setupWithFailures(['attributes_cable_type']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.cableTypes).toEqual([]);
		});

		test('should leave nodeTypes empty when attribute fetch fails', async () => {
			setupWithFailures(['attributes_node_type']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.nodeTypes).toEqual([]);
		});

		test('should leave statuses empty when attribute fetch fails', async () => {
			setupWithFailures(['attributes_status']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.statuses).toEqual([]);
		});

		test('should leave networkLevels empty when attribute fetch fails', async () => {
			setupWithFailures(['attributes_network_level']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.networkLevels).toEqual([]);
		});

		test('should leave companies empty when attribute fetch fails', async () => {
			setupWithFailures(['attributes_company']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.companies).toEqual([]);
		});

		test('should leave flags empty when attribute fetch fails', async () => {
			setupWithFailures(['flags']);

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.flags).toEqual([]);
		});

		test('should leave parentNodeOptions empty when all-nodes fetch fails', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && url.includes('minimal=true')) {
					return Promise.resolve({ ok: false, status: 500 });
				}
				if (url.includes('node/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 'node-1', properties: { uuid: 'node-1' } }])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.parentNodeOptions).toEqual([]);
		});

		test('should map parentNodeOptions when all-nodes fetch succeeds', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () =>
							Promise.resolve([
								{ id: 'node-1', name: 'Parent A' },
								{ id: 'node-2', name: 'Parent B' }
							])
					});
				}
				if (url.includes('node/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 'node-1', properties: { uuid: 'node-1' } }])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.parentNodeOptions).toEqual([
				{ value: 'node-1', label: 'Parent A' },
				{ value: 'node-2', label: 'Parent B' }
			]);
		});
	});

	describe('node payload shape handling', () => {
		test('should resolve parent node from nodesData.features', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () =>
							Promise.resolve({
								features: [{ id: 'node-1', properties: { uuid: 'node-1' } }]
							})
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = (await callLoad()) as Record<string, unknown>;

			expect((result.nodes as Record<string, unknown>).features).toBeDefined();
		});

		test('should match parent node by properties.uuid when top-level id absent', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ properties: { uuid: 'node-1' } }])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			// A matching parent avoids the empty-nodes redirect.
			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.isChildView).toBe(true);
		});

		test('should not redirect when nodes present but parent missing', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 'other-node' }])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = (await callLoad()) as Record<string, unknown>;

			expect(result.parentNodeId).toBe('node-1');
		});

		test('should attach labelData when cable uuid nested under cable field', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 'node-1', properties: { uuid: 'node-1' } }])
					});
				}
				if (url.includes('cable/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ cable: { uuid: 'cable-9' } }])
					});
				}
				if (url.includes('cable_label/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 1, cable: 'cable-9', offset_x: 5 }])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = (await callLoad()) as Record<string, unknown>;
			const cable = (result.cables as Record<string, unknown>[])[0];

			expect(cable.uuid).toBe('cable-9');
			expect((cable.labelData as Record<string, unknown>).offset_x).toBe(5);
		});

		test('should group multiple labels sharing one cable uuid', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
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
				if (url.includes('cable_label/all')) {
					return Promise.resolve({
						ok: true,
						json: () =>
							Promise.resolve([
								{ id: 1, cable: 'cable-1', offset_x: 1 },
								{ id: 2, cable: 'cable-1', offset_x: 2 }
							])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = (await callLoad()) as Record<string, unknown>;
			const cable = (result.cables as Record<string, unknown>[])[0];

			// First label of the group is attached.
			expect((cable.labelData as Record<string, unknown>).id).toBe(1);
		});

		test('should redirect when node payload is null (falls back to empty nodes)', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			await expect(callLoad()).rejects.toThrow('Redirect to /network-schema/proj-1');
		});

		test('should derive cable uuid from bare cable string reference', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ id: 'node-1', properties: { uuid: 'node-1' } }])
					});
				}
				if (url.includes('cable/all')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.resolve([{ cable: 'cable-str-7' }])
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			const result = (await callLoad()) as Record<string, unknown>;

			expect((result.cables as Record<string, unknown>[])[0].uuid).toBe('cable-str-7');
		});

		test('should throw redirect when a non-302 error occurs mid-load', async () => {
			mockFetch.mockImplementation((url: string) => {
				if (url.includes('node/all') && !url.includes('minimal=true')) {
					return Promise.resolve({
						ok: true,
						json: () => Promise.reject(new Error('boom'))
					});
				}
				return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
			});

			await expect(callLoad()).rejects.toThrow('Redirect to /network-schema/proj-1');
		});
	});
});
