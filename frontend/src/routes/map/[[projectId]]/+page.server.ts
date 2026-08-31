import type { Actions, PageServerLoad } from './$types';

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
	exportNodeExcel,
	getAddressesForNode,
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
	getSlotDividers,
	getUsedResidentialUnits
} from '$lib/server/nodeData';

/**
 * Loads node types, surfaces, construction types, and area types for the map page.
 */
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

/**
 * Form actions for map feature data retrieval and trench profile management.
 */
export const actions = {
	searchFeatures: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const searchQuery = data.get('searchQuery') as string;
		const projectId = data.get('projectId') as string;

		return searchFeaturesInProject(fetch, cookies, searchQuery, projectId);
	},

	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = data.get('featureType') as 'trench' | 'node' | 'address' | 'area';
		const featureUuid = data.get('featureUuid') as string;
		const projectId = data.get('projectId') as string;

		return getFeatureDetailsByType(fetch, cookies, featureType, featureUuid, projectId);
	},

	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = formData.get('uuid') as string;

		return getPipesInTrench(fetch, cookies, trenchId);
	},

	getMicroducts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const pipeId = formData.get('uuid') as string;

		return getMicroducts(fetch, cookies, pipeId);
	},

	getTrenchesForConduit: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitId = formData.get('uuid') as string;

		return getTrenchesForConduit(fetch, cookies, conduitId);
	},

	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid') as string;

		return getTrenchUuidsForConduit(fetch, cookies, conduitUuid);
	},
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = formData.get('layerType') as 'trench' | 'node' | 'address';
		const projectId = formData.get('projectId') as string;

		return getLayerExtent(fetch, cookies, layerType, projectId);
	},

	getContainerHierarchy: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid') as string;
		return getContainerHierarchy(fetch, cookies, nodeUuid);
	},

	getContainerTypes: async ({ fetch, cookies }) => {
		return getContainerTypes(fetch, cookies);
	},

	getSlotConfigurationsForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid') as string;
		return getSlotConfigurationsForNode(fetch, cookies, nodeUuid);
	},

	getNodeStructures: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid') as string;
		return getNodeStructures(fetch, cookies, slotConfigUuid);
	},

	getComponentTypes: async ({ fetch, cookies }) => {
		return getComponentTypes(fetch, cookies);
	},

	getSlotDividers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid') as string;
		return getSlotDividers(fetch, cookies, slotConfigUuid);
	},

	getSlotClipNumbers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid') as string;
		return getSlotClipNumbers(fetch, cookies, slotConfigUuid);
	},

	getCablesAtNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid') as string;
		return getCablesAtNode(fetch, cookies, nodeUuid);
	},

	getFibersForCable: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const cableUuid = formData.get('cableUuid') as string;
		return getFibersForCable(fetch, cookies, cableUuid);
	},

	getFiberColors: async ({ fetch, cookies }) => {
		return getFiberColors(fetch, cookies);
	},

	getComponentPorts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const componentTypeId = formData.get('componentTypeId') as string;
		return getComponentPorts(fetch, cookies, componentTypeId);
	},

	getFiberSplices: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeStructureUuid = formData.get('nodeStructureUuid') as string;
		return getFiberSplices(fetch, cookies, nodeStructureUuid);
	},

	getFiberUsageInNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid') as string;
		return getFiberUsageInNode(fetch, cookies, nodeUuid);
	},

	getTrenchProfile: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchUuid = formData.get('trenchUuid') as string;

		return getTrenchProfile(fetch, cookies, trenchUuid);
	},

	saveTrenchProfilePosition: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchUuid = formData.get('trenchUuid') as string;
		const conduitUuid = formData.get('conduitUuid') as string;
		const canvasX = parseFloat(formData.get('canvasX') as string);
		const canvasY = parseFloat(formData.get('canvasY') as string);
		const canvasWidth = parseFloat((formData.get('canvasWidth') as string) || '80');
		const canvasHeight = parseFloat((formData.get('canvasHeight') as string) || '80');

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
	},

	getAddressesForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid') as string;
		return getAddressesForNode(fetch, cookies, nodeUuid);
	},

	getUsedResidentialUnits: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid') as string;
		return getUsedResidentialUnits(fetch, cookies, nodeUuid);
	},

	exportExcel: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid') as string;
		return exportNodeExcel(fetch, cookies, nodeUuid);
	}
} satisfies Actions;
