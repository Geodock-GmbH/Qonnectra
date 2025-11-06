import { error } from '@sveltejs/kit';

import { searchFeaturesInProject, getFeatureDetailsByType } from '$lib/server/featureSearch';

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
	}
};
