import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

import { LAST_PROJECT_COOKIE } from '$lib/utils/rememberedProject';
import { resolveLandingPath } from '$lib/server/landing';

/**
 * Gate for the admin log view; the logs themselves are queried by the page.
 * A non-admin is sent to the landing page, or gets a 403 when their route
 * permissions allow no page at all.
 */
export const load: PageServerLoad = async ({ locals, parent, cookies }) => {
	if (!locals.user?.isAdmin) {
		const { projects } = await parent();
		const landing = resolveLandingPath(
			projects,
			cookies.get(LAST_PROJECT_COOKIE),
			locals.user?.permissions
		);
		if (!landing) error(403, 'Access denied');
		redirect(303, landing);
	}
};
