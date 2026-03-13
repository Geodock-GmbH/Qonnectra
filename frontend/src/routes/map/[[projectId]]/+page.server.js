import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';
import { getCablesInTrench } from '$lib/server/cableData';
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
 * @param {import('./$types').PageServerLoadEvent} event
 * @returns {Promise<Record<string, unknown>>} Combined attribute data for map rendering
 */
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

/**
 * Form actions for map feature data retrieval and trench profile management.
 * @type {import('./$types').Actions}
 */
export const actions = {
	searchFeatures: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const searchQuery = data.get('searchQuery');
		const projectId = data.get('projectId');

		return searchFeaturesInProject(
			fetch,
			cookies,
			/** @type {string} */ (searchQuery),
			/** @type {string} */ (projectId)
		);
	},

	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = data.get('featureType');
		const featureUuid = data.get('featureUuid');
		const projectId = data.get('projectId');

		return getFeatureDetailsByType(
			fetch,
			cookies,
			/** @type {"trench" | "node" | "address" | "area"} */ (featureType),
			/** @type {string} */ (featureUuid),
			/** @type {string} */ (projectId)
		);
	},

	getPipesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchId = formData.get('uuid');

		return getPipesInTrench(fetch, cookies, /** @type {string} */ (trenchId));
	},

	getMicroducts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const pipeId = formData.get('uuid');

		return getMicroducts(fetch, cookies, /** @type {string} */ (pipeId));
	},

	getCablesInTrench: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchUuid = formData.get('trenchUuid');

		return getCablesInTrench(fetch, cookies, /** @type {string} */ (trenchUuid));
	},

	getTrenchesForConduit: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitId = formData.get('uuid');

		return getTrenchesForConduit(fetch, cookies, /** @type {string} */ (conduitId));
	},

	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid');

		return getTrenchUuidsForConduit(fetch, cookies, /** @type {string} */ (conduitUuid));
	},
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = formData.get('layerType');
		const projectId = formData.get('projectId');

		return getLayerExtent(
			fetch,
			cookies,
			/** @type {"trench" | "node" | "address"} */ (layerType),
			/** @type {string} */ (projectId)
		);
	},

	getContainerHierarchy: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getContainerHierarchy(fetch, cookies, /** @type {string} */ (nodeUuid));
	},

	getContainerTypes: async ({ fetch, cookies }) => {
		return getContainerTypes(fetch, cookies);
	},

	getSlotConfigurationsForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getSlotConfigurationsForNode(fetch, cookies, /** @type {string} */ (nodeUuid));
	},

	getNodeStructures: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getNodeStructures(fetch, cookies, /** @type {string} */ (slotConfigUuid));
	},

	getComponentTypes: async ({ fetch, cookies }) => {
		return getComponentTypes(fetch, cookies);
	},

	getSlotDividers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getSlotDividers(fetch, cookies, /** @type {string} */ (slotConfigUuid));
	},

	getSlotClipNumbers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getSlotClipNumbers(fetch, cookies, /** @type {string} */ (slotConfigUuid));
	},

	getCablesAtNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getCablesAtNode(fetch, cookies, /** @type {string} */ (nodeUuid));
	},

	getFibersForCable: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const cableUuid = formData.get('cableUuid');
		return getFibersForCable(fetch, cookies, /** @type {string} */ (cableUuid));
	},

	getFiberColors: async ({ fetch, cookies }) => {
		return getFiberColors(fetch, cookies);
	},

	getComponentPorts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const componentTypeId = formData.get('componentTypeId');
		return getComponentPorts(fetch, cookies, /** @type {string} */ (componentTypeId));
	},

	getFiberSplices: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeStructureUuid = formData.get('nodeStructureUuid');
		return getFiberSplices(fetch, cookies, /** @type {string} */ (nodeStructureUuid));
	},

	getFiberUsageInNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getFiberUsageInNode(fetch, cookies, /** @type {string} */ (nodeUuid));
	},

	getTrenchProfile: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchUuid = formData.get('trenchUuid');

		return getTrenchProfile(fetch, cookies, /** @type {string} */ (trenchUuid));
	},

	saveTrenchProfilePosition: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const trenchUuid = formData.get('trenchUuid');
		const conduitUuid = formData.get('conduitUuid');
		const canvasX = parseFloat(/** @type {string} */ (formData.get('canvasX')));
		const canvasY = parseFloat(/** @type {string} */ (formData.get('canvasY')));
		const canvasWidth = parseFloat(/** @type {string} */ (formData.get('canvasWidth')) || '80');
		const canvasHeight = parseFloat(/** @type {string} */ (formData.get('canvasHeight')) || '80');

		return saveTrenchProfilePosition(
			fetch,
			cookies,
			/** @type {string} */ (trenchUuid),
			/** @type {string} */ (conduitUuid),
			canvasX,
			canvasY,
			canvasWidth,
			canvasHeight
		);
	},

	getAddressesForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getAddressesForNode(fetch, cookies, /** @type {string} */ (nodeUuid));
	},

	getUsedResidentialUnits: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getUsedResidentialUnits(fetch, cookies, /** @type {string} */ (nodeUuid));
	},

	exportExcel: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return exportNodeExcel(fetch, cookies, /** @type {string} */ (nodeUuid));
	}
};
