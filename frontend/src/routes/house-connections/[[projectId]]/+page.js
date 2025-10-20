import { getFieldAliases } from '$lib/utils/fieldAliases';

/** @type {import('./$types').PageLoad} */
export async function load() {
	return { alias: getFieldAliases() };
}
