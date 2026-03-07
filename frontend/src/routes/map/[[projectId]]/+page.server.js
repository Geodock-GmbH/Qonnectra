import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';
import {
	getMicroducts,
	getPipesInTrench,
	getTrenchesForConduit,
	getTrenchProfile,
	saveTrenchProfilePosition
} from '$lib/server/conduitData';
import {
	getFeatureDetailsByType,
	getLayerExtent,
	getTrenchUuidsForConduit,
	searchFeaturesInProject
} from '$lib/server/featureSearch';
import {
	getCablesAtNode,
	getComponentPorts,
	getComponentTypes,
	getContainerHierarchy,
	getContainerTypes,
	getFiberColors,
	getFibersForCable,
	getFiberSplices,
	getFiberUsageInNode,
	getNodeStructures,
	getSlotClipNumbers,
	getSlotConfigurationsForNode,
	getSlotDividers
} from '$lib/server/nodeData';

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
		const projectId = data.get('projectId');

		return getFeatureDetailsByType(fetch, cookies, featureType, featureUuid, projectId);
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
	},

	getTrenchesForConduit: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitId = formData.get('uuid');

		return getTrenchesForConduit(fetch, cookies, conduitId);
	},

	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid');

		return getTrenchUuidsForConduit(fetch, cookies, conduitUuid);
	},
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = formData.get('layerType');
		const projectId = formData.get('projectId');

		return getLayerExtent(fetch, cookies, layerType, projectId);
	},

	// Node structure panel actions (read-only for map route)
	getContainerHierarchy: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getContainerHierarchy(fetch, cookies, nodeUuid);
	},

	getContainerTypes: async ({ fetch, cookies }) => {
		return getContainerTypes(fetch, cookies);
	},

	getSlotConfigurationsForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getSlotConfigurationsForNode(fetch, cookies, nodeUuid);
	},

	getNodeStructures: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getNodeStructures(fetch, cookies, slotConfigUuid);
	},

	getComponentTypes: async ({ fetch, cookies }) => {
		return getComponentTypes(fetch, cookies);
	},

	getSlotDividers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getSlotDividers(fetch, cookies, slotConfigUuid);
	},

	getSlotClipNumbers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getSlotClipNumbers(fetch, cookies, slotConfigUuid);
	},

	getCablesAtNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getCablesAtNode(fetch, cookies, nodeUuid);
	},

	getFibersForCable: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const cableUuid = formData.get('cableUuid');
		return getFibersForCable(fetch, cookies, cableUuid);
	},

	getFiberColors: async ({ fetch, cookies }) => {
		return getFiberColors(fetch, cookies);
	},

	getComponentPorts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const componentTypeId = formData.get('componentTypeId');
		return getComponentPorts(fetch, cookies, componentTypeId);
	},

	getFiberSplices: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeStructureUuid = formData.get('nodeStructureUuid');
		return getFiberSplices(fetch, cookies, nodeStructureUuid);
	},

	getFiberUsageInNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getFiberUsageInNode(fetch, cookies, nodeUuid);
	},

	getTrenchProfile: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchUuid = formData.get('trenchUuid');

		return getTrenchProfile(fetch, cookies, trenchUuid);
	},

	saveTrenchProfilePosition: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchUuid = formData.get('trenchUuid');
		const conduitUuid = formData.get('conduitUuid');
		const canvasX = parseFloat(formData.get('canvasX'));
		const canvasY = parseFloat(formData.get('canvasY'));
		const canvasWidth = parseFloat(formData.get('canvasWidth') || '80');
		const canvasHeight = parseFloat(formData.get('canvasHeight') || '80');

		return saveTrenchProfilePosition(
			fetch,
			cookies,
			trenchUuid,
			conduitUuid,
			canvasX,
			canvasY,
			canvasWidth,
			canvasHeight
		);
	}
};
