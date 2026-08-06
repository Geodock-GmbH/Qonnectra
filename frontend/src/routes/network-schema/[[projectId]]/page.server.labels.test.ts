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

describe('getNodeDependencies', () => {
	test('should collect cables, structures, and children with cables', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('cable/at-node/node-1/')) {
				return Promise.resolve(okJson([{ uuid: 'cable-1' }]));
			}
			if (url.includes('node-structure/')) {
				return Promise.resolve(okJson([{ uuid: 'structure-1' }]));
			}
			if (url.includes('parent_node=node-1')) {
				return Promise.resolve(
					okJson({ features: [{ id: 'child-1', properties: { name: 'Kind 1' } }] })
				);
			}
			if (url.includes('cable/at-node/child-1/')) {
				return Promise.resolve(okJson([{ uuid: 'cable-2' }]));
			}
			return Promise.resolve(okJson([]));
		});

		const result = await actions.getNodeDependencies({
			request: makeRequest({ nodeUuid: 'node-1' }),
			fetch: fetchMock,
			cookies: mockCookies,
			params: { projectId: '7' }
		} as never);

		expect(result).toEqual({
			cables: [{ uuid: 'cable-1' }],
			structures: [{ uuid: 'structure-1' }],
			children: [{ id: 'child-1', properties: { name: 'Kind 1' } }],
			childrenWithCables: [{ nodeId: 'child-1', nodeName: 'Kind 1', cableCount: 1 }],
			hasChildren: true,
			hasCables: true,
			hasChildrenWithCables: true
		});
	});

	test('should fail without a node id', async () => {
		const result = await actions.getNodeDependencies({
			request: makeRequest({}),
			fetch: vi.fn(),
			cookies: mockCookies,
			params: {}
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});
});

describe('getCableSplices', () => {
	test('should merge and dedupe splices from both cable sides', async () => {
		const fetchMock = vi.fn((url: string) => {
			if (url.includes('cable_a=')) {
				return Promise.resolve(okJson([{ uuid: 'splice-1' }, { uuid: 'splice-2' }]));
			}
			return Promise.resolve(okJson([{ uuid: 'splice-2' }, { uuid: 'splice-3' }]));
		});

		const result = (await actions.getCableSplices({
			request: makeRequest({ cableUuid: 'cable-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never)) as { connectedFiberCount: number; splices: { uuid: string }[] };

		expect(result.connectedFiberCount).toBe(3);
		expect(result.splices.map((s: { uuid: string }) => s.uuid)).toEqual([
			'splice-1',
			'splice-2',
			'splice-3'
		]);
	});

	test('should fail without a cable uuid', async () => {
		const result = await actions.getCableSplices({
			request: makeRequest({}),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result).toMatchObject({ status: 400 });
	});
});

describe('updateCableLabel', () => {
	test('should PATCH directly when a label id is given', async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({ uuid: 'label-1' }));

		const result = await actions.updateCableLabel({
			request: makeRequest({
				labelId: 'label-1',
				cableId: 'cable-1',
				text: 'K-Nord',
				position_x: '10.5',
				position_y: '20.25'
			}),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/cable_label/label-1/',
			expect.objectContaining({ method: 'PATCH' })
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			text: 'K-Nord',
			position_x: 10.5,
			position_y: 20.25
		});
		expect(result).toMatchObject({ type: 'success', label: { uuid: 'label-1' } });
	});

	test('should update an existing label found by cable when no id is given', async () => {
		const fetchMock = vi.fn((url: string, options?: { method?: string }) => {
			if (options?.method === 'GET' || url.includes('cable_uuid=')) {
				return Promise.resolve(okJson([{ uuid: 'existing-label' }]));
			}
			return Promise.resolve(okJson({ uuid: 'existing-label' }));
		});

		await actions.updateCableLabel({
			request: makeRequest({
				cableId: 'cable-1',
				text: 'Neu',
				position_x: '1',
				position_y: '2'
			}),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/cable_label/existing-label/',
			expect.objectContaining({ method: 'PATCH' })
		);
	});

	test('should create a new label when none exists for the cable', async () => {
		const fetchMock = vi.fn((url: string, options?: { method?: string }) => {
			if (url.includes('cable_uuid=')) {
				return Promise.resolve(okJson([]));
			}
			if (options?.method === 'POST') {
				return Promise.resolve(okJson({ uuid: 'new-label' }));
			}
			return Promise.resolve(okJson({}));
		});

		const result = await actions.updateCableLabel({
			request: makeRequest({ cableId: 'cable-1', position_x: '1', position_y: '2', order: '3' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		const postCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST');
		expect(JSON.parse((postCall![1] as { body: string }).body)).toEqual({
			cable_id: 'cable-1',
			text: 'Label',
			position_x: 1,
			position_y: 2,
			order: 3
		});
		expect(result).toMatchObject({ type: 'success', label: { uuid: 'new-label' } });
	});

	test('should reject requests without cable id or position', async () => {
		const withoutCable = await actions.updateCableLabel({
			request: makeRequest({ position_x: '1', position_y: '2' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);
		expect(withoutCable).toEqual({ type: 'error', message: 'Cable ID is required' });

		const withoutPosition = await actions.updateCableLabel({
			request: makeRequest({ cableId: 'cable-1' }),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);
		expect(withoutPosition).toEqual({ type: 'error', message: 'Label position is required' });
	});
});

describe('deleteCableLabel', () => {
	test('should DELETE the label', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

		const result = await actions.deleteCableLabel({
			request: makeRequest({ labelId: 'label-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:8000/cable_label/label-1/',
			expect.objectContaining({ method: 'DELETE' })
		);
		expect(result).toMatchObject({ type: 'success' });
	});

	test('should reject without a label id', async () => {
		const result = await actions.deleteCableLabel({
			request: makeRequest({}),
			fetch: vi.fn(),
			cookies: mockCookies
		} as never);

		expect(result).toEqual({ type: 'error', message: 'Label ID is required' });
	});

	test('should surface backend errors', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ detail: 'Nicht gefunden' })
		});

		const result = await actions.deleteCableLabel({
			request: makeRequest({ labelId: 'label-1' }),
			fetch: fetchMock,
			cookies: mockCookies
		} as never);

		expect(result).toEqual({ status: 404, data: { message: 'Nicht gefunden' } });
	});
});
