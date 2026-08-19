import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { actions } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		const httpError = new Error(message) as Error & { status: number };
		httpError.status = status;
		return httpError;
	},
	fail: (status: number, data: Record<string, unknown>) => ({ status, data })
}));

const mockCookies = {
	get: (name: string) => (name === 'api-access-token' ? 'mock-token' : null)
} as unknown as Cookies;

function makeRequest(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.append(key, value);
	}
	return { formData: () => Promise.resolve(formData) };
}

function okJson(data: unknown) {
	return { ok: true, json: () => Promise.resolve(data) };
}

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('slot configuration actions', () => {
	test('getSlotConfigurations should fetch configurations for a node', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson([{ uuid: 'cfg-1' }]));

		const result = await actions.getSlotConfigurations({
			request: makeRequest({ nodeUuid: 'node-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-slot-configuration/by-node/node-1/',
			expect.objectContaining({ method: 'GET' })
		);
		expect(result).toEqual({ configurations: [{ uuid: 'cfg-1' }] });
	});

	test('getSlotConfigurations should fail without a node uuid', async () => {
		const result = await actions.getSlotConfigurations({
			request: makeRequest({}),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});

	test('createSlotConfiguration should post side and slot count', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({ uuid: 'cfg-1' }));

		const result = await actions.createSlotConfiguration({
			request: makeRequest({ nodeUuid: 'node-1', side: 'A', totalSlots: '24' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({ uuid_node_id: 'node-1', side: 'A', total_slots: 24 });
		expect(result).toEqual({ success: true, configuration: { uuid: 'cfg-1' } });
	});

	test('createSlotConfiguration should surface backend errors', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 409,
			json: () => Promise.resolve({ detail: 'Seite bereits belegt' })
		});

		const result = await actions.createSlotConfiguration({
			request: makeRequest({ nodeUuid: 'node-1', side: 'A', totalSlots: '24' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(result).toEqual({ status: 409, data: { error: 'Seite bereits belegt' } });
	});

	test('updateSlotConfiguration should PATCH only provided fields', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({ uuid: 'cfg-1' }));

		await actions.updateSlotConfiguration({
			request: makeRequest({ configUuid: 'cfg-1', totalSlots: '48' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-slot-configuration/cfg-1/',
			expect.objectContaining({ method: 'PATCH' })
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ total_slots: 48 });
	});

	test('deleteSlotConfiguration should call DELETE', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({}));

		const result = await actions.deleteSlotConfiguration({
			request: makeRequest({ configUuid: 'cfg-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-slot-configuration/cfg-1/',
			expect.objectContaining({ method: 'DELETE' })
		);
		expect(result).toEqual({ success: true });
	});
});

describe('container actions', () => {
	test('createContainer should post node, type, and optional parent', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({ uuid: 'container-1' }));

		const result = await actions.createContainer({
			request: makeRequest({
				nodeUuid: 'node-1',
				containerTypeId: '3',
				name: 'Rack A',
				parentContainerId: 'parent-1'
			}),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toEqual({
			uuid_node_id: 'node-1',
			container_type_id: 3,
			name: 'Rack A',
			parent_container_id: 'parent-1'
		});
		expect(result).toEqual({ success: true, container: { uuid: 'container-1' } });
	});

	test('createContainer should fail without required fields', async () => {
		const result = await actions.createContainer({
			request: makeRequest({ nodeUuid: 'node-1' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});

	test('deleteContainer should call DELETE on the container', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({}));

		const result = await actions.deleteContainer({
			request: makeRequest({ containerUuid: 'container-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/container/container-1/',
			expect.objectContaining({ method: 'DELETE' })
		);
		expect(result).toEqual({ success: true });
	});

	test('updateContainerName should PATCH the name and allow clearing it', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({ uuid: 'container-1' }));

		await actions.updateContainerName({
			request: makeRequest({ containerUuid: 'container-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: null });
	});

	test('moveItem should route containers to the container move endpoint', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({}));

		await actions.moveItem({
			request: makeRequest({
				itemType: 'container',
				itemUuid: 'container-1',
				targetContainerId: 'parent-2'
			}),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/container/container-1/move/',
			expect.anything()
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			parent_container_id: 'parent-2'
		});
	});

	test('moveItem should route slot configurations to the move-to-container endpoint', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({}));

		await actions.moveItem({
			request: makeRequest({ itemType: 'slot_configuration', itemUuid: 'cfg-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/node-slot-configuration/cfg-1/move-to-container/',
			expect.anything()
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ container_id: null });
	});

	test('moveItem should reject unknown item types', async () => {
		const result = await actions.moveItem({
			request: makeRequest({ itemType: 'spaceship', itemUuid: 'x' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result).toEqual({ status: 400, data: { error: 'Invalid item type' } });
	});

	test('toggleContainerExpanded should flip the current state', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(okJson({ uuid: 'container-1', is_expanded: true }))
			.mockResolvedValueOnce(okJson({}));

		const result = await actions.toggleContainerExpanded({
			request: makeRequest({ containerUuid: 'container-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ is_expanded: false });
		expect(result).toEqual({ success: true });
	});
});
