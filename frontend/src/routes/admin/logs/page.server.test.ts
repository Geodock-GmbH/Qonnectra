import { describe, expect, test } from 'vitest';

import { load } from './+page.server.js';

function createLoadArgs(locals: Record<string, unknown>) {
	return { locals } as unknown as Parameters<typeof load>[0];
}

describe('admin logs +page.server.ts', () => {
	test('redirects non-admin users to /map', async () => {
		await expect(load(createLoadArgs({ user: { isAdmin: false } }))).rejects.toEqual(
			expect.objectContaining({ status: 303, location: '/map' })
		);
	});

	test('redirects when no user is set', async () => {
		await expect(load(createLoadArgs({}))).rejects.toEqual(
			expect.objectContaining({ status: 303, location: '/map' })
		);
	});

	test('lets admins through without loading data', async () => {
		await expect(load(createLoadArgs({ user: { isAdmin: true } }))).resolves.toBeUndefined();
	});
});
