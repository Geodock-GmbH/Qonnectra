import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock the environment variable
vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

// Mock SvelteKit error/fail helpers
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

/**
 * These tests cover the form actions in the untested region of +page.server.ts
 * (node structures, slot dividers/clips, fiber splices, cable/micropipe wiring,
 * addresses, fiber status and Excel export).
 *
 * Every one of these actions destructures `fetch` from the event, so we always
 * pass `fetch: mockFetch` in the event object (no globalThis stubbing needed).
 */
describe('+page.server.js actions', () => {
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

	/** Builds a request whose formData() resolves to a Map of the given entries. */
	function makeRequest(entries: [string, string][]) {
		return {
			formData: () => Promise.resolve(new Map(entries))
		};
	}

	/** Runs an action with the standard event shape (event fetch + cookies). */
	async function runAction(name: string, entries: [string, string][] = []) {
		const { actions } = await import('./+page.server.js');
		return (await (
			actions as unknown as Record<string, (event: Record<string, unknown>) => unknown>
		)[name]({
			request: makeRequest(entries),
			fetch: mockFetch,
			cookies: mockCookies
		})) as Record<string, unknown>;
	}

	function okJson(body: unknown) {
		return { ok: true, json: () => Promise.resolve(body) };
	}

	function errJson(status: number, body: unknown) {
		return { ok: false, status, json: () => Promise.resolve(body) };
	}

	// ---------------------------------------------------------------------------
	// Delegating "getter" actions (helpers in $lib/server/nodeData)
	// ---------------------------------------------------------------------------

	describe('getSlotConfigurationsForNode', () => {
		test('returns configurations from the by-node endpoint', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'cfg-1' }]));

			const result = await runAction('getSlotConfigurationsForNode', [['nodeUuid', 'node-1']]);

			expect(result.configurations).toEqual([{ uuid: 'cfg-1' }]);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/node-slot-configuration/by-node/node-1/'
			);
			expect(mockFetch.mock.calls[0][1].method).toBe('GET');
		});

		test('propagates API failure status', async () => {
			mockFetch.mockResolvedValueOnce(errJson(404, { detail: 'nope' }));

			const result = await runAction('getSlotConfigurationsForNode', [['nodeUuid', 'node-1']]);

			expect(result.status).toBe(404);
			expect((result.data as Record<string, unknown>).error).toBe('nope');
		});
	});

	describe('getNodeStructures', () => {
		test('returns structures filtered by slot configuration', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 's-1' }]));

			const result = await runAction('getNodeStructures', [['slotConfigUuid', 'cfg-9']]);

			expect(result.structures).toEqual([{ uuid: 's-1' }]);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/node-structure/?slot_configuration=cfg-9'
			);
		});
	});

	describe('getComponentTypes', () => {
		test('returns component types', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ id: 1, name: 'Splitter' }]));

			const result = await runAction('getComponentTypes');

			expect(result.componentTypes).toEqual([{ id: 1, name: 'Splitter' }]);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/attributes_component_type/');
		});

		test('propagates API failure', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

			const result = await runAction('getComponentTypes');

			expect(result.status).toBe(500);
		});
	});

	describe('getSlotDividers', () => {
		test('returns dividers array', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'd-1' }]));

			const result = await runAction('getSlotDividers', [['slotConfigUuid', 'cfg-1']]);

			expect(result.dividers).toEqual([{ uuid: 'd-1' }]);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/node-slot-divider/?slot_configuration=cfg-1'
			);
		});
	});

	describe('getSlotClipNumbers', () => {
		test('returns clip numbers array', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ slot_number: 1, clip_number: 'A' }]));

			const result = await runAction('getSlotClipNumbers', [['slotConfigUuid', 'cfg-2']]);

			expect(result.clipNumbers).toEqual([{ slot_number: 1, clip_number: 'A' }]);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/node-slot-clip-number/?slot_configuration=cfg-2'
			);
		});
	});

	describe('getCablesAtNode', () => {
		test('returns cables at node', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'cab-1' }]));

			const result = await runAction('getCablesAtNode', [['nodeUuid', 'node-x']]);

			expect(result.cables).toEqual([{ uuid: 'cab-1' }]);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/cable/at-node/node-x/');
		});
	});

	describe('getFibersForCable', () => {
		test('returns fibers for cable', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'fib-1' }]));

			const result = await runAction('getFibersForCable', [['cableUuid', 'cab-7']]);

			expect(result.fibers).toEqual([{ uuid: 'fib-1' }]);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/fiber/by-cable/cab-7/');
		});
	});

	describe('getFiberColors', () => {
		test('returns fiber colors', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ color: 'red' }]));

			const result = await runAction('getFiberColors');

			expect(result.fiberColors).toEqual([{ color: 'red' }]);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/attributes_fiber_color/');
		});
	});

	describe('getComponentPorts', () => {
		test('returns ports for component type', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ port: 1 }]));

			const result = await runAction('getComponentPorts', [['componentTypeId', '42']]);

			expect(result.ports).toEqual([{ port: 1 }]);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/attributes_component_structure/?component_type=42'
			);
		});
	});

	describe('getFiberSplices', () => {
		test('returns splices for node structure', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'sp-1' }]));

			const result = await runAction('getFiberSplices', [['nodeStructureUuid', 'ns-1']]);

			expect(result.splices).toEqual([{ uuid: 'sp-1' }]);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/fiber-splice/?node_structure=ns-1'
			);
		});
	});

	describe('getFiberUsageInNode', () => {
		test('maps used fiber uuids and component map', async () => {
			mockFetch.mockResolvedValueOnce(
				okJson({
					used_uuids: ['f-1', 'f-2'],
					fiber_component_map: { 'f-1': { component_label: 'C1' } }
				})
			);

			const result = await runAction('getFiberUsageInNode', [['nodeUuid', 'node-1']]);

			expect(result.usedFiberUuids).toEqual(['f-1', 'f-2']);
			expect((result.fiberComponentMap as Record<string, unknown>)['f-1']).toEqual({
				component_label: 'C1'
			});
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/node/node-1/used-fibers/');
		});
	});

	describe('getAddressesForNode', () => {
		test('returns addresses list', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ addresses: [{ uuid: 'addr-1' }] }));

			const result = await runAction('getAddressesForNode', [['nodeUuid', 'node-1']]);

			expect(result.addresses).toEqual([{ uuid: 'addr-1' }]);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/node/node-1/addresses/');
		});
	});

	describe('getUsedResidentialUnits', () => {
		test('returns used residential unit uuids', async () => {
			mockFetch.mockResolvedValueOnce(
				okJson({
					used_uuids: ['ru-1'],
					residential_unit_component_map: { 'ru-1': { component_label: 'C2' } }
				})
			);

			const result = await runAction('getUsedResidentialUnits', [['nodeUuid', 'node-1']]);

			expect(result.used_uuids).toEqual(['ru-1']);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/node/node-1/used-residential-units/'
			);
		});
	});

	// ---------------------------------------------------------------------------
	// createNodeStructure
	// ---------------------------------------------------------------------------

	describe('createNodeStructure', () => {
		test('creates a structure with coerced numeric slots', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'struct-1' }));

			const result = await runAction('createNodeStructure', [
				['nodeUuid', 'node-1'],
				['slotConfigUuid', 'cfg-1'],
				['componentTypeId', '5'],
				['slotStart', '2'],
				['slotEnd', '4'],
				['label', 'My label']
			]);

			expect(result.success).toBe(true);
			expect((result.structure as Record<string, unknown>).uuid).toBe('struct-1');

			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/node-structure/');
			expect(call[1].method).toBe('POST');
			const body = JSON.parse(call[1].body);
			expect(body.uuid_node_id).toBe('node-1');
			expect(body.slot_configuration_id).toBe('cfg-1');
			expect(body.slot_start).toBe(2);
			expect(body.slot_end).toBe(4);
			expect(body.component_type_id).toBe(5);
			expect(body.label).toBe('My label');
			expect(body.purpose).toBe('component');
		});

		test('returns 400 when required fields are missing', async () => {
			const result = await runAction('createNodeStructure', [['nodeUuid', 'node-1']]);

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('Missing required fields');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('surfaces field errors from the API', async () => {
			mockFetch.mockResolvedValueOnce(errJson(400, { slot_start: ['Overlaps existing'] }));

			const result = await runAction('createNodeStructure', [
				['nodeUuid', 'node-1'],
				['slotConfigUuid', 'cfg-1'],
				['slotStart', '2'],
				['slotEnd', '4']
			]);

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('slot_start');
			expect((result.data as Record<string, unknown>).error).toContain('Overlaps existing');
		});
	});

	// ---------------------------------------------------------------------------
	// bulkCreateNodeStructures
	// ---------------------------------------------------------------------------

	describe('bulkCreateNodeStructures', () => {
		test('sends bulk payload and returns created/failed counts', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ created: 3, failed: 1 }));

			const result = await runAction('bulkCreateNodeStructures', [
				['nodeUuid', 'node-1'],
				['slotConfigUuid', 'cfg-1'],
				['componentTypeId', '5'],
				['slotStart', '1'],
				['count', '3'],
				['occupiedSlotsPerComponent', '2']
			]);

			expect(result.success).toBe(true);
			expect(result.created).toBe(3);
			expect(result.failed).toBe(1);

			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/node-structure/bulk-create/');
			const body = JSON.parse(call[1].body);
			expect(body.node_uuid).toBe('node-1');
			expect(body.component_type_id).toBe(5);
			expect(body.slot_start).toBe(1);
			expect(body.count).toBe(3);
			expect(body.occupied_slots_per_component).toBe(2);
		});

		test('returns 400 when required fields are missing', async () => {
			const result = await runAction('bulkCreateNodeStructures', [['nodeUuid', 'node-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// moveNodeStructure
	// ---------------------------------------------------------------------------

	describe('moveNodeStructure', () => {
		test('moves a structure to a new slot start', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'struct-1', slot_start: 7 }));

			const result = await runAction('moveNodeStructure', [
				['structureUuid', 'struct-1'],
				['slotStart', '7']
			]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/node-structure/struct-1/move/');
			expect(JSON.parse(call[1].body).slot_start).toBe(7);
		});

		test('returns 400 when parameters are missing', async () => {
			const result = await runAction('moveNodeStructure', [['structureUuid', 'struct-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// deleteNodeStructure
	// ---------------------------------------------------------------------------

	describe('deleteNodeStructure', () => {
		test('deletes a structure', async () => {
			mockFetch.mockResolvedValueOnce(okJson({}));

			const result = await runAction('deleteNodeStructure', [['structureUuid', 'struct-1']]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/node-structure/struct-1/');
			expect(call[1].method).toBe('DELETE');
		});

		test('returns 400 without structureUuid', async () => {
			const result = await runAction('deleteNodeStructure', []);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// createSlotDivider / deleteSlotDivider
	// ---------------------------------------------------------------------------

	describe('createSlotDivider', () => {
		test('creates divider after a slot', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'div-1' }));

			const result = await runAction('createSlotDivider', [
				['slotConfigUuid', 'cfg-1'],
				['afterSlot', '3']
			]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/node-slot-divider/');
			const body = JSON.parse(call[1].body);
			expect(body.slot_configuration_id).toBe('cfg-1');
			expect(body.after_slot).toBe(3);
		});

		test('returns 400 when fields missing', async () => {
			const result = await runAction('createSlotDivider', [['slotConfigUuid', 'cfg-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('deleteSlotDivider', () => {
		test('deletes divider', async () => {
			mockFetch.mockResolvedValueOnce(okJson({}));

			const result = await runAction('deleteSlotDivider', [['dividerUuid', 'div-1']]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/node-slot-divider/div-1/');
			expect(call[1].method).toBe('DELETE');
		});

		test('returns 400 without dividerUuid', async () => {
			const result = await runAction('deleteSlotDivider', []);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// upsertSlotClipNumber
	// ---------------------------------------------------------------------------

	describe('upsertSlotClipNumber', () => {
		test('upserts a clip number', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ slot_number: 3, clip_number: 'B2' }));

			const result = await runAction('upsertSlotClipNumber', [
				['slotConfigUuid', 'cfg-1'],
				['slotNumber', '3'],
				['clipNumber', 'B2']
			]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/node-slot-clip-number/upsert/');
			const body = JSON.parse(call[1].body);
			expect(body.slot_configuration_id).toBe('cfg-1');
			expect(body.slot_number).toBe(3);
			expect(body.clip_number).toBe('B2');
		});

		test('returns 400 when fields missing', async () => {
			const result = await runAction('upsertSlotClipNumber', [['slotConfigUuid', 'cfg-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// upsertFiberSplice
	// ---------------------------------------------------------------------------

	describe('upsertFiberSplice', () => {
		test('upserts a fiber splice with fiber + cable', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'splice-1' }));

			const result = await runAction('upsertFiberSplice', [
				['nodeStructureUuid', 'ns-1'],
				['portNumber', '5'],
				['side', 'a'],
				['fiberUuid', 'fib-1'],
				['cableUuid', 'cab-1']
			]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/fiber-splice/upsert/');
			const body = JSON.parse(call[1].body);
			expect(body.node_structure).toBe('ns-1');
			expect(body.port_number).toBe(5);
			expect(body.side).toBe('a');
			expect(body.fiber_uuid).toBe('fib-1');
			expect(body.cable_uuid).toBe('cab-1');
			expect(body.residential_unit_uuid).toBeUndefined();
		});

		test('upserts with a residential unit when no fiber given', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'splice-2' }));

			await runAction('upsertFiberSplice', [
				['nodeStructureUuid', 'ns-1'],
				['portNumber', '1'],
				['side', 'b'],
				['residentialUnitUuid', 'ru-1']
			]);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.residential_unit_uuid).toBe('ru-1');
			expect(body.fiber_uuid).toBeUndefined();
		});

		test('returns 400 when core fields missing', async () => {
			const result = await runAction('upsertFiberSplice', [['nodeStructureUuid', 'ns-1']]);

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('Missing required fields');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('returns 400 when neither fiber nor residential unit given', async () => {
			const result = await runAction('upsertFiberSplice', [
				['nodeStructureUuid', 'ns-1'],
				['portNumber', '1'],
				['side', 'a']
			]);

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).error).toContain('residentialUnitUuid');
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// bulkUpsertFiberSplices
	// ---------------------------------------------------------------------------

	describe('bulkUpsertFiberSplices', () => {
		test('parses splices JSON and forwards to bulk endpoint', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ created: 2, failed: 0 }));

			const splices = [{ port_number: 1 }, { port_number: 2 }];
			const result = await runAction('bulkUpsertFiberSplices', [
				['splices', JSON.stringify(splices)]
			]);

			expect(result.success).toBe(true);
			expect(result.created).toBe(2);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/fiber-splice/bulk-upsert/');
			expect(JSON.parse(call[1].body).splices).toEqual(splices);
		});

		test('returns 400 when splices data missing', async () => {
			const result = await runAction('bulkUpsertFiberSplices', []);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// clearFiberSplice
	// ---------------------------------------------------------------------------

	describe('clearFiberSplice', () => {
		test('clears a port', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ deleted: 1 }));

			const result = await runAction('clearFiberSplice', [
				['nodeStructureUuid', 'ns-1'],
				['portNumber', '2'],
				['side', 'a']
			]);

			expect(result.success).toBe(true);
			expect(result.deleted).toBe(1);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/fiber-splice/clear-port/');
			const body = JSON.parse(call[1].body);
			expect(body.node_structure).toBe('ns-1');
			expect(body.port_number).toBe(2);
			expect(body.side).toBe('a');
		});

		test('returns 400 when fields missing', async () => {
			const result = await runAction('clearFiberSplice', [['nodeStructureUuid', 'ns-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// mergePorts / unmergePorts / upsertMergedSplice
	// ---------------------------------------------------------------------------

	describe('mergePorts', () => {
		test('merges ports and spreads API result', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ merge_group: 'mg-1' }));

			const result = await runAction('mergePorts', [
				['nodeStructureUuid', 'ns-1'],
				['portNumbers', JSON.stringify([1, 2, 3])],
				['side', 'a']
			]);

			expect(result.success).toBe(true);
			expect(result.merge_group).toBe('mg-1');
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/fiber-splice/merge-ports/');
			const body = JSON.parse(call[1].body);
			expect(body.node_structure).toBe('ns-1');
			expect(body.port_numbers).toEqual([1, 2, 3]);
			expect(body.side).toBe('a');
		});

		test('returns 400 with fewer than 2 ports', async () => {
			const result = await runAction('mergePorts', [
				['nodeStructureUuid', 'ns-1'],
				['portNumbers', JSON.stringify([1])]
			]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('unmergePorts', () => {
		test('unmerges ports', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ unmerged: true }));

			const result = await runAction('unmergePorts', [
				['mergeGroup', 'mg-1'],
				['portNumbers', JSON.stringify([1])]
			]);

			expect(result.success).toBe(true);
			expect(result.unmerged).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/fiber-splice/unmerge-ports/');
			const body = JSON.parse(call[1].body);
			expect(body.merge_group).toBe('mg-1');
			expect(body.port_numbers).toEqual([1]);
		});

		test('returns 400 when merge group missing', async () => {
			const result = await runAction('unmergePorts', [['portNumbers', JSON.stringify([1])]]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('upsertMergedSplice', () => {
		test('connects fibers to merged ports', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ ok: 1 }));

			const fibers = [{ fiber_uuid: 'f-1', cable_uuid: 'c-1' }];
			const result = await runAction('upsertMergedSplice', [
				['mergeGroup', 'mg-1'],
				['side', 'a'],
				['fibers', JSON.stringify(fibers)]
			]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/fiber-splice/upsert-merged/');
			const body = JSON.parse(call[1].body);
			expect(body.merge_group).toBe('mg-1');
			expect(body.side).toBe('a');
			expect(body.fibers).toEqual(fibers);
		});

		test('returns 400 when fibers empty', async () => {
			const result = await runAction('upsertMergedSplice', [
				['mergeGroup', 'mg-1'],
				['side', 'a'],
				['fibers', JSON.stringify([])]
			]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// updateCableConnection
	// ---------------------------------------------------------------------------

	describe('updateCableConnection', () => {
		test('patches only the provided connection fields', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'cab-1', updated: true }));

			const result = await runAction('updateCableConnection', [
				['uuid', 'cab-1'],
				['uuid_node_start_id', 'node-start'],
				['handle_start', 'top']
			]);

			expect(result.success).toBe(true);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/cable/cab-1/');
			expect(call[1].method).toBe('PATCH');
			const body = JSON.parse(call[1].body);
			expect(body.uuid_node_start_id).toBe('node-start');
			expect(body.handle_start).toBe('top');
			expect(body.uuid_node_end_id).toBeUndefined();
			expect(body.handle_end).toBeUndefined();
		});

		test('returns 400 when cable ID missing', async () => {
			const result = await runAction('updateCableConnection', [['handle_start', 'top']]);

			expect(result.status).toBe(400);
			expect((result.data as Record<string, unknown>).message).toContain('Cable ID');
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('propagates API error', async () => {
			mockFetch.mockResolvedValueOnce(errJson(422, { detail: 'bad' }));

			const result = await runAction('updateCableConnection', [
				['uuid', 'cab-1'],
				['uuid_node_start_id', 'node-start']
			]);

			expect(result.status).toBe(422);
			expect((result.data as Record<string, unknown>).message).toBe('bad');
		});
	});

	// ---------------------------------------------------------------------------
	// getCableSplicesAtNode / deleteCableSplicesAtNode
	// ---------------------------------------------------------------------------

	describe('getCableSplicesAtNode', () => {
		test('merges cable_a and cable_b splices and dedupes by uuid', async () => {
			// splices A query
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'sp-1' }, { uuid: 'sp-2' }]));
			// splices B query (sp-2 duplicate + new sp-3)
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'sp-2' }, { uuid: 'sp-3' }]));

			const result = await runAction('getCableSplicesAtNode', [
				['cableUuid', 'cab-1'],
				['nodeUuid', 'node-1']
			]);

			expect(result.connectedFiberCount).toBe(3);
			expect((result.splices as unknown[]).length).toBe(3);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/fiber-splice/?cable_a=cab-1&node_structure__uuid_node=node-1'
			);
			expect(mockFetch.mock.calls[1][0]).toBe(
				'http://localhost:8000/fiber-splice/?cable_b=cab-1&node_structure__uuid_node=node-1'
			);
		});

		test('returns 400 when uuids missing', async () => {
			const result = await runAction('getCableSplicesAtNode', [['cableUuid', 'cab-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('deleteCableSplicesAtNode', () => {
		test('deletes all matched splices and reports counts', async () => {
			// GET cable_a
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'sp-1' }]));
			// GET cable_b
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'sp-2' }]));
			// DELETE sp-1
			mockFetch.mockResolvedValueOnce({ ok: true });
			// DELETE sp-2
			mockFetch.mockResolvedValueOnce({ ok: true });

			const result = await runAction('deleteCableSplicesAtNode', [
				['cableUuid', 'cab-1'],
				['nodeUuid', 'node-1']
			]);

			expect(result.success).toBe(true);
			expect(result.deletedCount).toBe(2);
			expect(result.failedCount).toBe(0);

			const deleteCalls = mockFetch.mock.calls.filter((c) => c[1]?.method === 'DELETE');
			expect(deleteCalls.length).toBe(2);
			expect(deleteCalls.map((c) => c[0]).sort()).toEqual([
				'http://localhost:8000/fiber-splice/sp-1/',
				'http://localhost:8000/fiber-splice/sp-2/'
			]);
		});

		test('reports failed deletes', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'sp-1' }]));
			mockFetch.mockResolvedValueOnce(okJson([]));
			mockFetch.mockResolvedValueOnce({ ok: false });

			const result = await runAction('deleteCableSplicesAtNode', [
				['cableUuid', 'cab-1'],
				['nodeUuid', 'node-1']
			]);

			expect(result.deletedCount).toBe(0);
			expect(result.failedCount).toBe(1);
		});

		test('returns 400 when uuids missing', async () => {
			const result = await runAction('deleteCableSplicesAtNode', [['nodeUuid', 'node-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// getTrenchesForCable / getConduitsByTrenches / getMicropipesByConduits
	// ---------------------------------------------------------------------------

	describe('getTrenchesForCable', () => {
		test('collects unique trenches from both node selections', async () => {
			// GET cable
			mockFetch.mockResolvedValueOnce(
				okJson({ uuid_node_start: 'node-a', uuid_node_end: 'node-b' })
			);
			// selections for node-a
			mockFetch.mockResolvedValueOnce(okJson([{ trench: { uuid: 't-1' } }]));
			// selections for node-b (duplicate t-1 + new t-2)
			mockFetch.mockResolvedValueOnce(
				okJson([{ trench: { uuid: 't-1' } }, { trench: { uuid: 't-2' } }])
			);

			const result = await runAction('getTrenchesForCable', [['cableId', 'cab-1']]);

			expect((result.trenches as unknown[]).length).toBe(2);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/cable/cab-1/');
			expect(mockFetch.mock.calls[1][0]).toBe(
				'http://localhost:8000/node-trench-selection/by-node/node-a/'
			);
		});

		test('returns 400 without cableId', async () => {
			const result = await runAction('getTrenchesForCable', []);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		test('returns empty trenches when cable has no nodes', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid_node_start: null, uuid_node_end: null }));

			const result = await runAction('getTrenchesForCable', [['cableId', 'cab-1']]);

			expect(result.trenches).toEqual([]);
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});

	describe('getConduitsByTrenches', () => {
		test('fetches conduits and includes cable_id in query', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'con-1' }]));

			const result = await runAction('getConduitsByTrenches', [
				['trenchIds', 't-1,t-2'],
				['cableId', 'cab-1']
			]);

			expect(result.conduits).toEqual([{ uuid: 'con-1' }]);
			const url = mockFetch.mock.calls[0][0];
			expect(url).toContain('conduits/by-trenches/?trench_ids=');
			expect(url).toContain(encodeURIComponent('t-1,t-2'));
			expect(url).toContain('cable_id=cab-1');
		});

		test('returns empty conduits when no trenchIds', async () => {
			const result = await runAction('getConduitsByTrenches', []);

			expect(result.conduits).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('getMicropipesByConduits', () => {
		test('fetches micropipes by conduit ids', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ uuid: 'mp-1' }]));

			const result = await runAction('getMicropipesByConduits', [
				['conduitIds', 'con-1,con-2'],
				['cableId', 'cab-1']
			]);

			expect(result.micropipes).toEqual([{ uuid: 'mp-1' }]);
			const url = mockFetch.mock.calls[0][0];
			expect(url).toContain('micropipes/by-conduits/?conduit_ids=');
			expect(url).toContain('cable_id=cab-1');
		});

		test('returns empty micropipes when no conduitIds', async () => {
			const result = await runAction('getMicropipesByConduits', []);

			expect(result.micropipes).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// createMicropipeConnections / deleteMicropipeConnections
	// ---------------------------------------------------------------------------

	describe('createMicropipeConnections', () => {
		test('creates connections with parsed conduit ids', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ created: 2 }));

			const result = await runAction('createMicropipeConnections', [
				['cableId', 'cab-1'],
				['micropipeNumber', '4'],
				['color', 'blue'],
				['conduitIds', JSON.stringify(['con-1', 'con-2'])]
			]);

			expect(result.success).toBe(true);
			expect(result.created).toBe(2);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/cables/cab-1/micropipe-connections/');
			expect(call[1].method).toBe('POST');
			const body = JSON.parse(call[1].body);
			expect(body.micropipe_number).toBe(4);
			expect(body.color).toBe('blue');
			expect(body.conduit_ids).toEqual(['con-1', 'con-2']);
		});

		test('returns 400 when fields missing', async () => {
			const result = await runAction('createMicropipeConnections', [['cableId', 'cab-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('deleteMicropipeConnections', () => {
		test('deletes connections with DELETE method', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ deleted: 2 }));

			const result = await runAction('deleteMicropipeConnections', [
				['cableId', 'cab-1'],
				['micropipeNumber', '4'],
				['conduitIds', JSON.stringify(['con-1'])]
			]);

			expect(result.success).toBe(true);
			expect(result.deleted).toBe(2);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/cables/cab-1/micropipe-connections/');
			expect(call[1].method).toBe('DELETE');
			const body = JSON.parse(call[1].body);
			expect(body.micropipe_number).toBe(4);
			expect(body.conduit_ids).toEqual(['con-1']);
		});

		test('returns 400 when fields missing', async () => {
			const result = await runAction('deleteMicropipeConnections', [['cableId', 'cab-1']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// getLinkedTrenchesForCable / getConduitsForCable
	// ---------------------------------------------------------------------------

	describe('getLinkedTrenchesForCable', () => {
		test('returns trench uuids', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ trench_uuids: ['t-1', 't-2'] }));

			const result = await runAction('getLinkedTrenchesForCable', [['cableId', 'cab-1']]);

			expect(result.trench_uuids).toEqual(['t-1', 't-2']);
			expect(mockFetch.mock.calls[0][0]).toBe(
				'http://localhost:8000/cables/cab-1/linked-trenches/'
			);
		});

		test('returns 400 without cableId', async () => {
			const result = await runAction('getLinkedTrenchesForCable', []);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe('getConduitsForCable', () => {
		test('returns conduit names', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ conduit_names: ['C1', 'C2'] }));

			const result = await runAction('getConduitsForCable', [['cableId', 'cab-1']]);

			expect(result.conduit_names).toEqual(['C1', 'C2']);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/cables/cab-1/conduits/');
		});

		test('returns 400 without cableId', async () => {
			const result = await runAction('getConduitsForCable', []);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// recalculateCableLength
	// ---------------------------------------------------------------------------

	describe('recalculateCableLength', () => {
		test('returns length and total length', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ length: 12.5, length_total: 20 }));

			const result = await runAction('recalculateCableLength', [['uuid', 'cab-1']]);

			expect(result.length).toBe(12.5);
			expect(result.length_total).toBe(20);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/cable/cab-1/recalculate-length/');
			expect(call[1].method).toBe('POST');
		});

		test('returns 400 without cable id', async () => {
			const result = await runAction('recalculateCableLength', []);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// getFiberStatusOptions / updateFiberStatus
	// ---------------------------------------------------------------------------

	describe('getFiberStatusOptions', () => {
		test('returns raw status options', async () => {
			mockFetch.mockResolvedValueOnce(okJson([{ id: 1, name: 'active' }]));

			const result = (await runAction('getFiberStatusOptions')) as unknown as unknown[];

			expect(result).toEqual([{ id: 1, name: 'active' }]);
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/attributes_fiber_status/');
		});

		test('propagates API failure', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) });

			const result = await runAction('getFiberStatusOptions');

			expect(result.status).toBe(503);
		});
	});

	describe('updateFiberStatus', () => {
		test('patches fiber status with numeric id', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'fib-1', fiber_status_id: 2 }));

			const result = await runAction('updateFiberStatus', [
				['uuid', 'fib-1'],
				['fiber_status_id', '2']
			]);

			expect((result as Record<string, unknown>).fiber_status_id).toBe(2);
			const call = mockFetch.mock.calls[0];
			expect(call[0]).toBe('http://localhost:8000/fiber/fib-1/');
			expect(call[1].method).toBe('PATCH');
			expect(JSON.parse(call[1].body).fiber_status_id).toBe(2);
		});

		test('sends null when status id is the string "null"', async () => {
			mockFetch.mockResolvedValueOnce(okJson({ uuid: 'fib-1', fiber_status_id: null }));

			await runAction('updateFiberStatus', [
				['uuid', 'fib-1'],
				['fiber_status_id', 'null']
			]);

			expect(JSON.parse(mockFetch.mock.calls[0][1].body).fiber_status_id).toBeNull();
		});

		test('returns 400 when uuid missing', async () => {
			const result = await runAction('updateFiberStatus', [['fiber_status_id', '2']]);

			expect(result.status).toBe(400);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// exportExcel
	// ---------------------------------------------------------------------------

	describe('exportExcel', () => {
		test('returns base64 file data and parsed filename', async () => {
			const bytes = new Uint8Array([1, 2, 3, 4]);
			mockFetch.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: () => Promise.resolve(bytes.buffer),
				headers: {
					get: (name: string) =>
						name === 'Content-Disposition' ? 'attachment; filename="node-export.xlsx"' : null
				}
			});

			const result = await runAction('exportExcel', [['nodeUuid', 'node-1']]);

			expect(result.fileName).toBe('node-export.xlsx');
			expect(result.fileData).toBe(Buffer.from(bytes).toString('base64'));
			expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/node-export/excel/node-1/');
		});

		test('propagates export failure', async () => {
			mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

			const result = await runAction('exportExcel', [['nodeUuid', 'node-1']]);

			expect(result.status).toBe(500);
			expect((result.data as Record<string, unknown>).error).toBe('Export failed');
		});
	});
});
