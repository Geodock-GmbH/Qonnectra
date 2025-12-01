import { getNodeTypes } from '$lib/server/attributes';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies }) {
	return getNodeTypes(fetch, cookies);
}
