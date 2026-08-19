import type { PageServerLoad } from './$types';

import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';

/** Loads node types, surfaces, construction types, and area types for the settings page. */
export const load: PageServerLoad = async ({ fetch, cookies }) => {
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
};
