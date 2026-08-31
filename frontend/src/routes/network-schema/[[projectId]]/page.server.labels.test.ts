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
