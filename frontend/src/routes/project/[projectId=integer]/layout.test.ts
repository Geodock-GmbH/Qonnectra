import { describe, expect, test } from 'vitest';

import { load } from './+layout';

const projects = [
	{ value: '7', label: 'Nord' },
	{ value: '9', label: 'Süd' }
];

function run(
	projectId: string,
	parentData: { projects: typeof projects; projectsError: string | null }
) {
	return load({
		params: { projectId },
		parent: () => Promise.resolve(parentData)
	} as never) as Promise<{ project: { id: string; label: string } }>;
}

describe('project layout load', () => {
	test('should expose a known project with its label', async () => {
		await expect(run('9', { projects, projectsError: null })).resolves.toEqual({
			project: { id: '9', label: 'Süd' }
		});
	});

	test('should 404 for a project the user cannot see', async () => {
		await expect(run('42', { projects, projectsError: null })).rejects.toMatchObject({
			status: 404
		});
	});

	test('should pass the id through when the project list failed to load', async () => {
		await expect(
			run('42', { projects: [], projectsError: 'Failed to fetch projects' })
		).resolves.toEqual({
			project: { id: '42', label: '' }
		});
	});
});
