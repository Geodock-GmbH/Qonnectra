import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * Gate for the admin log view; the logs themselves are queried by the page.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user?.isAdmin) {
		throw redirect(303, '/map');
	}
};
