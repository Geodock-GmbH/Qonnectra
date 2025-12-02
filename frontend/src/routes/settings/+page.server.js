import { getConstructionTypes, getNodeTypes, getSurfaces } from '$lib/server/attributes';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies }) {
	const [nodeTypesData, surfacesData, constructionTypesData] = await Promise.all([
		getNodeTypes(fetch, cookies),
		getSurfaces(fetch, cookies),
		getConstructionTypes(fetch, cookies)
	]);

	return {
		...nodeTypesData,
		...surfacesData,
		...constructionTypesData
	};
}
