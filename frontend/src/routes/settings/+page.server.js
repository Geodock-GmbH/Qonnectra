import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies }) {
	const [nodeTypesData, surfacesData, constructionTypesData, areaTypesData] = await Promise.all([
		getNodeTypes(fetch, cookies),
		getSurfaces(fetch, cookies),
		getConstructionTypes(fetch, cookies),
		getAreaTypes(fetch, cookies)
	]);

	return {
		...nodeTypesData,
		...surfacesData,
		...constructionTypesData,
		...areaTypesData
	};
}
