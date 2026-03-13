import { getFieldAliases } from '$lib/utils/fieldAliases';

/**
 * Extends server-loaded data with field alias mappings for display labels.
 * @param {import('./$types').PageLoadEvent} event
 */
export async function load({ data }) {
	return { ...data, alias: getFieldAliases() };
}
