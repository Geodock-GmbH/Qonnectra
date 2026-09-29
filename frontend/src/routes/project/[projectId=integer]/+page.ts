import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

/** A project without a sub-route lands on its map. */
export const load: PageLoad = ({ params }) => {
	redirect(303, resolve('/project/[projectId=integer]/map', { projectId: params.projectId }));
};
