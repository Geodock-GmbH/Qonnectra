import type { PageLoad } from './$types';

import { getFieldAliases } from '$lib/utils/fieldAliases';

/**
 * Extends server-loaded data with field alias mappings for display labels.
 */
export const load: PageLoad = async ({ data }) => {
	return { ...data, alias: getFieldAliases() };
};
