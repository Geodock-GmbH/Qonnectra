import { describe, expect, test } from 'vitest';

import { load } from './+page.server.js';

const projects = [
	{ value: '7', label: 'Nord' },
	{ value: '9', label: 'Süd' }
];

function createLoadArgs(locals: Record<string, unknown>, lastProject?: string) {
	return {
		locals,
		parent: () => Promise.resolve({ projects }),
		cookies: { get: (name: string) => (name === 'last-project' ? lastProject : undefined) }
	} as unknown as Parameters<typeof load>[0];
}

describe('admin logs +page.server.ts', () => {
	test('redirects non-admin users to the landing page of the remembered project', async () => {
		await expect(load(createLoadArgs({ user: { isAdmin: false } }, '9'))).rejects.toEqual(
			expect.objectContaining({ status: 303, location: '/project/9/map' })
		);
	});

	test('redirects when no user is set, landing on the first project', async () => {
		await expect(load(createLoadArgs({}))).rejects.toEqual(
			expect.objectContaining({ status: 303, location: '/project/7/map' })
		);
	});

	test('redirects a non-admin denied the map to the first page they may open', async () => {
		const permissions = { models: {}, routes: { '/map': false }, is_superuser: false };
		await expect(
			load(createLoadArgs({ user: { isAdmin: false, permissions } }, '9'))
		).rejects.toEqual(expect.objectContaining({ status: 303, location: '/project/9/dashboard' }));
	});

	test('answers 403 for a non-admin who may open no page at all', async () => {
		const permissions = { models: {}, routes: { '/*': false }, is_superuser: false };
		await expect(load(createLoadArgs({ user: { isAdmin: false, permissions } }))).rejects.toEqual(
			expect.objectContaining({ status: 403 })
		);
	});

	test('lets admins through without loading data', async () => {
		await expect(load(createLoadArgs({ user: { isAdmin: true } }))).resolves.toBeUndefined();
	});
});
