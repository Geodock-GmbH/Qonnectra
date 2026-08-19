import type { PageLoad } from './$types';

import { getFieldAliases } from '$lib/utils/fieldAliases';

/**
 * Merges server-loaded data with client-side field aliases.
 */
export const load: PageLoad = async ({ data }) => {
	return { ...data, alias: getFieldAliases() };
};
