import { getFieldAliases } from '$lib/utils/fieldAliases';

/**
 * Merges server-loaded data with client-side field aliases.
 * @type {import('./$types').PageLoad}
 */
export async function load({ data }) {
	return { ...data, alias: getFieldAliases() };
}
