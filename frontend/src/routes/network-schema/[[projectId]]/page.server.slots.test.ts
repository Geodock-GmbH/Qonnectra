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
});
