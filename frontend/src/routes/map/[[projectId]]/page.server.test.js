import { beforeEach, describe, expect, test, vi } from 'vitest';

import { actions, load } from './+page.server.js';

vi.mock('$env/static/private', () => ({
	API_URL: 'http://localhost:8000/'
}));

vi.mock('$lib/server/attributes', () => ({
	getNodeTypes: vi.fn(() =>
		Promise.resolve({ nodeTypes: [{ uuid: 'nt-1', name: 'Type A' }], nodeTypesError: null })
	),
	getSurfaces: vi.fn(() =>
		Promise.resolve({ surfaces: [{ uuid: 's-1', name: 'Asphalt' }], surfacesError: null })
	),
	getConstructionTypes: vi.fn(() =>
		Promise.resolve({
			constructionTypes: [{ uuid: 'ct-1', name: 'Open' }],
			constructionTypesError: null
		})
	),
	getAreaTypes: vi.fn(() =>
		Promise.resolve({
			areaTypes: [{ uuid: 'at-1', name: 'Residential' }],
			areaTypesError: null
		})
	)
}));

vi.mock('$lib/server/conduitData', () => ({
	getPipesInTrench: vi.fn(),
	getMicroducts: vi.fn(),
	getTrenchesForConduit: vi.fn(),
	getTrenchProfile: vi.fn(),
	saveTrenchProfilePosition: vi.fn()
}));

vi.mock('$lib/server/cableData', () => ({
	getCablesInTrench: vi.fn()
}));

vi.mock('$lib/server/featureSearch', () => ({
	searchFeaturesInProject: vi.fn(),
	getFeatureDetailsByType: vi.fn(),
	getTrenchUuidsForConduit: vi.fn(),
	getLayerExtent: vi.fn()
}));

vi.mock('$lib/server/nodeData', () => ({
	getContainerHierarchy: vi.fn(),
	getContainerTypes: vi.fn(),
	getSlotConfigurationsForNode: vi.fn(),
	getNodeStructures: vi.fn(),
	getComponentTypes: vi.fn(),
	getSlotDividers: vi.fn(),
	getSlotClipNumbers: vi.fn(),
	getCablesAtNode: vi.fn(),
	getFibersForCable: vi.fn(),
	getFiberColors: vi.fn(),
	getComponentPorts: vi.fn(),
	getFiberSplices: vi.fn(),
	getFiberUsageInNode: vi.fn(),
	getAddressesForNode: vi.fn(),
	getUsedResidentialUnits: vi.fn(),
	exportNodeExcel: vi.fn()
}));

vi.mock('$lib/utils/getAuthHeaders', () => ({
	getAuthHeaders: vi.fn(() => ({ Cookie: 'api-access-token=mock-token' }))
}));

describe('map +page.server.js', () => {
	/** @type {any} */
	let mockFetch;
	/** @type {any} */
	let mockCookies;

	beforeEach(() => {
		vi.clearAllMocks();

		mockFetch = vi.fn();
		mockCookies = {
			get: vi.fn(() => 'mock-token'),
			set: vi.fn()
		};
	});

	/**
	 * Creates a mock request event with form data.
	 * @param {Record<string, string>} formFields - Key-value pairs to populate the FormData
	 * @returns {any} Mock SvelteKit request event
	 */
	function createEvent(formFields = {}) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(formFields)) {
			formData.set(key, value);
		}
		return {
			request: { formData: () => Promise.resolve(formData) },
			fetch: mockFetch,
			cookies: mockCookies
		};
	}

	describe('load', () => {
		test('should load all attribute data in parallel', async () => {
			const result = await load(/** @type {any} */ ({ fetch: mockFetch, cookies: mockCookies }));

			expect(result).toEqual({
				nodeTypes: [{ uuid: 'nt-1', name: 'Type A' }],
				nodeTypesError: null,
				surfaces: [{ uuid: 's-1', name: 'Asphalt' }],
				surfacesError: null,
				constructionTypes: [{ uuid: 'ct-1', name: 'Open' }],
				constructionTypesError: null,
				areaTypes: [{ uuid: 'at-1', name: 'Residential' }],
				areaTypesError: null
			});
		});
	});

	describe('searchFeatures', () => {
		test('should call searchFeaturesInProject with correct params', async () => {
			const { searchFeaturesInProject } = await import('$lib/server/featureSearch');
			/** @type {any} */ (searchFeaturesInProject).mockResolvedValueOnce([
				{ value: 'uuid-1', label: 'Node 1' }
			]);

			const result = await actions.searchFeatures(
				createEvent({ searchQuery: 'test', projectId: 'proj-1' })
			);

			expect(searchFeaturesInProject).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'test',
				'proj-1'
			);
			expect(result).toEqual([{ value: 'uuid-1', label: 'Node 1' }]);
		});
	});

	describe('getFeatureDetails', () => {
		test('should call getFeatureDetailsByType with correct params', async () => {
			const { getFeatureDetailsByType } = await import('$lib/server/featureSearch');
			/** @type {any} */ (getFeatureDetailsByType).mockResolvedValueOnce({
				success: true,
				feature: { id: 'uuid-1' }
			});

			const result = await actions.getFeatureDetails(
				createEvent({ featureType: 'node', featureUuid: 'uuid-1', projectId: 'proj-1' })
			);

			expect(getFeatureDetailsByType).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'node',
				'uuid-1',
				'proj-1'
			);
			expect(result).toEqual({ success: true, feature: { id: 'uuid-1' } });
		});
	});

	describe('getPipesInTrench', () => {
		test('should call getPipesInTrench with trench UUID', async () => {
			const { getPipesInTrench } = await import('$lib/server/conduitData');
			/** @type {any} */ (getPipesInTrench).mockResolvedValueOnce([{ uuid: 'pipe-1' }]);

			const result = await actions.getPipesInTrench(createEvent({ uuid: 'trench-123' }));

			expect(getPipesInTrench).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench-123');
			expect(result).toEqual([{ uuid: 'pipe-1' }]);
		});
	});

	describe('getMicroducts', () => {
		test('should call getMicroducts with pipe UUID', async () => {
			const { getMicroducts } = await import('$lib/server/conduitData');
			/** @type {any} */ (getMicroducts).mockResolvedValueOnce([{ uuid: 'md-1', color: 'red' }]);

			const result = await actions.getMicroducts(createEvent({ uuid: 'pipe-456' }));

			expect(getMicroducts).toHaveBeenCalledWith(mockFetch, mockCookies, 'pipe-456');
			expect(result).toEqual([{ uuid: 'md-1', color: 'red' }]);
		});
	});

	describe('getCablesInTrench', () => {
		test('should call getCablesInTrench with trench UUID', async () => {
			const { getCablesInTrench } = await import('$lib/server/cableData');
			/** @type {any} */ (getCablesInTrench).mockResolvedValueOnce([{ uuid: 'cable-1' }]);

			const result = await actions.getCablesInTrench(createEvent({ trenchUuid: 'trench-1' }));

			expect(getCablesInTrench).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench-1');
			expect(result).toEqual([{ uuid: 'cable-1' }]);
		});
	});

	describe('getTrenchesForConduit', () => {
		test('should call getTrenchesForConduit with conduit UUID', async () => {
			const { getTrenchesForConduit } = await import('$lib/server/conduitData');
			/** @type {any} */ (getTrenchesForConduit).mockResolvedValueOnce([{ uuid: 't-1' }]);

			const result = await actions.getTrenchesForConduit(createEvent({ uuid: 'conduit-1' }));

			expect(getTrenchesForConduit).toHaveBeenCalledWith(mockFetch, mockCookies, 'conduit-1');
			expect(result).toEqual([{ uuid: 't-1' }]);
		});
	});

	describe('getConduitTrenches', () => {
		test('should call getTrenchUuidsForConduit with conduit UUID', async () => {
			const { getTrenchUuidsForConduit } = await import('$lib/server/featureSearch');
			/** @type {any} */ (getTrenchUuidsForConduit).mockResolvedValueOnce({
				trenchUuids: ['t-1', 't-2']
			});

			const result = await actions.getConduitTrenches(createEvent({ conduitUuid: 'conduit-1' }));

			expect(getTrenchUuidsForConduit).toHaveBeenCalledWith(mockFetch, mockCookies, 'conduit-1');
			expect(result).toEqual({ trenchUuids: ['t-1', 't-2'] });
		});
	});

	describe('getLayerExtent', () => {
		test('should call getLayerExtent with layer type and project ID', async () => {
			const { getLayerExtent } = await import('$lib/server/featureSearch');
			/** @type {any} */ (getLayerExtent).mockResolvedValueOnce({ extent: [1, 2, 3, 4] });

			const result = await actions.getLayerExtent(
				createEvent({ layerType: 'trench', projectId: 'proj-1' })
			);

			expect(getLayerExtent).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench', 'proj-1');
			expect(result).toEqual({ extent: [1, 2, 3, 4] });
		});
	});

	describe('getContainerHierarchy', () => {
		test('should call getContainerHierarchy with node UUID', async () => {
			const { getContainerHierarchy } = await import('$lib/server/nodeData');
			/** @type {any} */ (getContainerHierarchy).mockResolvedValueOnce({
				containers: [{ uuid: 'c-1' }]
			});

			const result = await actions.getContainerHierarchy(createEvent({ nodeUuid: 'node-1' }));

			expect(getContainerHierarchy).toHaveBeenCalledWith(mockFetch, mockCookies, 'node-1');
			expect(result).toEqual({ containers: [{ uuid: 'c-1' }] });
		});
	});

	describe('getContainerTypes', () => {
		test('should call getContainerTypes', async () => {
			const { getContainerTypes } = await import('$lib/server/nodeData');
			/** @type {any} */ (getContainerTypes).mockResolvedValueOnce([{ uuid: 'ct-1' }]);

			const result = await actions.getContainerTypes(createEvent());

			expect(getContainerTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
			expect(result).toEqual([{ uuid: 'ct-1' }]);
		});
	});

	describe('getSlotConfigurationsForNode', () => {
		test('should call getSlotConfigurationsForNode with node UUID', async () => {
			const { getSlotConfigurationsForNode } = await import('$lib/server/nodeData');
			/** @type {any} */ (getSlotConfigurationsForNode).mockResolvedValueOnce([{ uuid: 'sc-1' }]);

			const result = await actions.getSlotConfigurationsForNode(
				createEvent({ nodeUuid: 'node-1' })
			);

			expect(getSlotConfigurationsForNode).toHaveBeenCalledWith(mockFetch, mockCookies, 'node-1');
			expect(result).toEqual([{ uuid: 'sc-1' }]);
		});
	});

	describe('getNodeStructures', () => {
		test('should call getNodeStructures with slot config UUID', async () => {
			const { getNodeStructures } = await import('$lib/server/nodeData');
			/** @type {any} */ (getNodeStructures).mockResolvedValueOnce([{ uuid: 'ns-1' }]);

			const result = await actions.getNodeStructures(createEvent({ slotConfigUuid: 'sc-1' }));

			expect(getNodeStructures).toHaveBeenCalledWith(mockFetch, mockCookies, 'sc-1');
			expect(result).toEqual([{ uuid: 'ns-1' }]);
		});
	});

	describe('getComponentTypes', () => {
		test('should call getComponentTypes', async () => {
			const { getComponentTypes } = await import('$lib/server/nodeData');
			/** @type {any} */ (getComponentTypes).mockResolvedValueOnce([
				{ uuid: 'comp-1', name: 'Splitter' }
			]);

			const result = await actions.getComponentTypes(createEvent());

			expect(getComponentTypes).toHaveBeenCalledWith(mockFetch, mockCookies);
			expect(result).toEqual([{ uuid: 'comp-1', name: 'Splitter' }]);
		});
	});

	describe('getSlotDividers', () => {
		test('should call getSlotDividers with slot config UUID', async () => {
			const { getSlotDividers } = await import('$lib/server/nodeData');
			/** @type {any} */ (getSlotDividers).mockResolvedValueOnce([{ uuid: 'sd-1' }]);

			const result = await actions.getSlotDividers(createEvent({ slotConfigUuid: 'sc-1' }));

			expect(getSlotDividers).toHaveBeenCalledWith(mockFetch, mockCookies, 'sc-1');
			expect(result).toEqual([{ uuid: 'sd-1' }]);
		});
	});

	describe('getSlotClipNumbers', () => {
		test('should call getSlotClipNumbers with slot config UUID', async () => {
			const { getSlotClipNumbers } = await import('$lib/server/nodeData');
			/** @type {any} */ (getSlotClipNumbers).mockResolvedValueOnce([1, 2, 3]);

			const result = await actions.getSlotClipNumbers(createEvent({ slotConfigUuid: 'sc-1' }));

			expect(getSlotClipNumbers).toHaveBeenCalledWith(mockFetch, mockCookies, 'sc-1');
			expect(result).toEqual([1, 2, 3]);
		});
	});

	describe('getCablesAtNode', () => {
		test('should call getCablesAtNode with node UUID', async () => {
			const { getCablesAtNode } = await import('$lib/server/nodeData');
			/** @type {any} */ (getCablesAtNode).mockResolvedValueOnce([{ uuid: 'cable-1' }]);

			const result = await actions.getCablesAtNode(createEvent({ nodeUuid: 'node-1' }));

			expect(getCablesAtNode).toHaveBeenCalledWith(mockFetch, mockCookies, 'node-1');
			expect(result).toEqual([{ uuid: 'cable-1' }]);
		});
	});

	describe('getFibersForCable', () => {
		test('should call getFibersForCable with cable UUID', async () => {
			const { getFibersForCable } = await import('$lib/server/nodeData');
			/** @type {any} */ (getFibersForCable).mockResolvedValueOnce([{ uuid: 'fiber-1' }]);

			const result = await actions.getFibersForCable(createEvent({ cableUuid: 'cable-1' }));

			expect(getFibersForCable).toHaveBeenCalledWith(mockFetch, mockCookies, 'cable-1');
			expect(result).toEqual([{ uuid: 'fiber-1' }]);
		});
	});

	describe('getFiberColors', () => {
		test('should call getFiberColors', async () => {
			const { getFiberColors } = await import('$lib/server/nodeData');
			/** @type {any} */ (getFiberColors).mockResolvedValueOnce([{ uuid: 'fc-1', color: 'blue' }]);

			const result = await actions.getFiberColors(createEvent());

			expect(getFiberColors).toHaveBeenCalledWith(mockFetch, mockCookies);
			expect(result).toEqual([{ uuid: 'fc-1', color: 'blue' }]);
		});
	});

	describe('getComponentPorts', () => {
		test('should call getComponentPorts with component type ID', async () => {
			const { getComponentPorts } = await import('$lib/server/nodeData');
			/** @type {any} */ (getComponentPorts).mockResolvedValueOnce([{ uuid: 'port-1' }]);

			const result = await actions.getComponentPorts(createEvent({ componentTypeId: 'comp-1' }));

			expect(getComponentPorts).toHaveBeenCalledWith(mockFetch, mockCookies, 'comp-1');
			expect(result).toEqual([{ uuid: 'port-1' }]);
		});
	});

	describe('getFiberSplices', () => {
		test('should call getFiberSplices with node structure UUID', async () => {
			const { getFiberSplices } = await import('$lib/server/nodeData');
			/** @type {any} */ (getFiberSplices).mockResolvedValueOnce([{ uuid: 'splice-1' }]);

			const result = await actions.getFiberSplices(createEvent({ nodeStructureUuid: 'ns-1' }));

			expect(getFiberSplices).toHaveBeenCalledWith(mockFetch, mockCookies, 'ns-1');
			expect(result).toEqual([{ uuid: 'splice-1' }]);
		});
	});

	describe('getFiberUsageInNode', () => {
		test('should call getFiberUsageInNode with node UUID', async () => {
			const { getFiberUsageInNode } = await import('$lib/server/nodeData');
			/** @type {any} */ (getFiberUsageInNode).mockResolvedValueOnce({ used: 10, total: 24 });

			const result = await actions.getFiberUsageInNode(createEvent({ nodeUuid: 'node-1' }));

			expect(getFiberUsageInNode).toHaveBeenCalledWith(mockFetch, mockCookies, 'node-1');
			expect(result).toEqual({ used: 10, total: 24 });
		});
	});

	describe('getTrenchProfile', () => {
		test('should call getTrenchProfile with trench UUID', async () => {
			const { getTrenchProfile } = await import('$lib/server/conduitData');
			/** @type {any} */ (getTrenchProfile).mockResolvedValueOnce({
				conduits: [{ uuid: 'c-1' }]
			});

			const result = await actions.getTrenchProfile(createEvent({ trenchUuid: 'trench-1' }));

			expect(getTrenchProfile).toHaveBeenCalledWith(mockFetch, mockCookies, 'trench-1');
			expect(result).toEqual({ conduits: [{ uuid: 'c-1' }] });
		});
	});

	describe('saveTrenchProfilePosition', () => {
		test('should call saveTrenchProfilePosition with all params', async () => {
			const { saveTrenchProfilePosition } = await import('$lib/server/conduitData');
			/** @type {any} */ (saveTrenchProfilePosition).mockResolvedValueOnce({ success: true });

			const result = await actions.saveTrenchProfilePosition(
				createEvent({
					trenchUuid: 'trench-1',
					conduitUuid: 'conduit-1',
					canvasX: '100',
					canvasY: '200',
					canvasWidth: '80',
					canvasHeight: '60'
				})
			);

			expect(saveTrenchProfilePosition).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'trench-1',
				'conduit-1',
				100,
				200,
				80,
				60
			);
			expect(result).toEqual({ success: true });
		});

		test('should use default width/height when not provided', async () => {
			const { saveTrenchProfilePosition } = await import('$lib/server/conduitData');
			/** @type {any} */ (saveTrenchProfilePosition).mockResolvedValueOnce({ success: true });

			await actions.saveTrenchProfilePosition(
				createEvent({
					trenchUuid: 'trench-1',
					conduitUuid: 'conduit-1',
					canvasX: '50',
					canvasY: '75'
				})
			);

			expect(saveTrenchProfilePosition).toHaveBeenCalledWith(
				mockFetch,
				mockCookies,
				'trench-1',
				'conduit-1',
				50,
				75,
				80,
				80
			);
		});
	});

	describe('getAddressesForNode', () => {
		test('should call getAddressesForNode with node UUID', async () => {
			const { getAddressesForNode } = await import('$lib/server/nodeData');
			/** @type {any} */ (getAddressesForNode).mockResolvedValueOnce([{ uuid: 'addr-1' }]);

			const result = await actions.getAddressesForNode(createEvent({ nodeUuid: 'node-1' }));

			expect(getAddressesForNode).toHaveBeenCalledWith(mockFetch, mockCookies, 'node-1');
			expect(result).toEqual([{ uuid: 'addr-1' }]);
		});
	});

	describe('getUsedResidentialUnits', () => {
		test('should call getUsedResidentialUnits with node UUID', async () => {
			const { getUsedResidentialUnits } = await import('$lib/server/nodeData');
			/** @type {any} */ (getUsedResidentialUnits).mockResolvedValueOnce([{ uuid: 'ru-1' }]);

			const result = await actions.getUsedResidentialUnits(createEvent({ nodeUuid: 'node-1' }));

			expect(getUsedResidentialUnits).toHaveBeenCalledWith(mockFetch, mockCookies, 'node-1');
			expect(result).toEqual([{ uuid: 'ru-1' }]);
		});
	});

	describe('exportExcel', () => {
		test('should call exportNodeExcel with node UUID', async () => {
			const { exportNodeExcel } = await import('$lib/server/nodeData');
			/** @type {any} */ (exportNodeExcel).mockResolvedValueOnce({ data: 'excel-blob' });

			const result = await actions.exportExcel(createEvent({ nodeUuid: 'node-1' }));

			expect(exportNodeExcel).toHaveBeenCalledWith(mockFetch, mockCookies, 'node-1');
			expect(result).toEqual({ data: 'excel-blob' });
		});
	});
});
