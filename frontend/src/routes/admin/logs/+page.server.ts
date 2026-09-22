import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { LAST_PROJECT_COOKIE } from '$lib/utils/rememberedProject';
import { resolveLandingPath } from '$lib/server/landing';

/**
 * Gate for the admin log view; the logs themselves are queried by the page.
 * A non-admin is sent to the landing page.
 */
export const load: PageServerLoad = async ({ locals, parent, cookies }) => {
	if (!locals.user?.isAdmin) {
		const { projects } = await parent();
		redirect(303, resolveLandingPath(projects, cookies.get(LAST_PROJECT_COOKIE)));
	}
};
