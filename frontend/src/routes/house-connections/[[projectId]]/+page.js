import { getFieldAliases } from '$lib/utils/fieldAliases';

/** @type {import('./$types').PageLoad} */
export async function load({ data }) {
	return { ...data, alias: getFieldAliases() };
}
