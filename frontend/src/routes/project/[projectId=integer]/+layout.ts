import type { LayoutLoad } from './$types';
import { error } from '@sveltejs/kit';

/**
 * Validates the project in the URL against the user's projects. When the
 * project list itself could not be loaded the id is passed through, so a
 * Django outage renders the pages' error boundaries instead of looking like
 * "project not found".
 */
export const load: LayoutLoad = async ({ params, parent }) => {
	const { projects, projectsError } = await parent();
	const project = projects.find((candidate) => candidate.value === params.projectId);

	if (!project && !projectsError) {
		error(404, 'Project not found');
	}

	return { project: { id: params.projectId, label: project?.label ?? '' } };
};
