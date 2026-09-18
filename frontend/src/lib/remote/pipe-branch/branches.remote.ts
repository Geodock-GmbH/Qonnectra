import type { PipeBranchList } from './branch-data';
import { query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { toPipeBranchList } from './branch-data';

const ProjectIdSchema = v.pipe(v.string(), v.nonEmpty());

/**
 * Fetch the nodes of a project that act as pipe branches.
 * @param projectId - Project ID.
 * @returns The branch options and whether the project configured its pipe-branch node types.
 * @throws When the backend request fails.
 */
export const getPipeBranches = query(
	ProjectIdSchema,
	async (projectId): Promise<PipeBranchList> => {
		const response = await fetch(
			`${API_URL}node/all/?project=${encodeURIComponent(projectId)}&use_pipe_branch_settings=true&minimal=true`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to fetch pipe branches');

		return toPipeBranchList(await response.json());
	}
);
