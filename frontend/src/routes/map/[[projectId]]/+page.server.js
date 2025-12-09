import { getConstructionTypes, getNodeTypes, getSurfaces } from '$lib/server/attributes';
import { getMicroducts, getPipesInTrench } from '$lib/server/conduitData';
import { getFeatureDetailsByType, searchFeaturesInProject } from '$lib/server/featureSearch';

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

/** @type {import('./$types').Actions} */
export const actions = {
	searchFeatures: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const searchQuery = data.get('searchQuery');
		const projectId = data.get('projectId');

		return searchFeaturesInProject(fetch, cookies, searchQuery, projectId);
	},

	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = data.get('featureType');
		const featureUuid = data.get('featureUuid');

		return getFeatureDetailsByType(fetch, cookies, featureType, featureUuid);
	},

	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = formData.get('uuid');

		return getPipesInTrench(fetch, cookies, trenchId);
	},

	getMicroducts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const pipeId = formData.get('uuid');

		return getMicroducts(fetch, cookies, pipeId);
	}
};
