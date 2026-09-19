import '@testing-library/jest-dom/vitest';

import { settled, tick } from 'svelte';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi } from 'vitest';

// With `compilerOptions.experimental.async` on, component unmount is deferred:
// testing-library's auto-cleanup calls `unmount()` but the DOM removal and any
// in-flight async teardown settle on a later microtask. Without awaiting that,
// stale DOM from one test leaks into the next → `getByRole` "multiple elements"
// and hook timeouts. This afterEach registers last, so it runs first in
// vitest's reverse-order teardown: it settles pending async work, unmounts, and
// waits for the deferred teardown to flush before the next test renders.
afterEach(async () => {
	await settled();
	cleanup();
	await tick();
	await settled();
});

// The remote functions ($app/server query/command) can't load in the jsdom
// unit-test SSR context (the SvelteKit remote plugin references build-time
// path globals). Any component/class that imports them transitively gets
// these inert stubs; tests that need to observe a call override with their
// own vi.mock in the test file.
vi.mock('$lib/remote/network-schema/paths.remote', () => ({
	saveCableGeometry: vi.fn().mockResolvedValue({})
}));
vi.mock('$lib/remote/network-schema/labels.remote', () => ({
	upsertCableLabel: vi.fn().mockResolvedValue({ position_x: 0, position_y: 0, text: '', uuid: '' }),
	deleteCableLabel: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/remote/network-schema/cables.remote', () => ({
	getCableDetails: vi.fn().mockResolvedValue({}),
	createCable: vi.fn().mockResolvedValue({ uuid: '' }),
	updateCable: vi.fn().mockResolvedValue({}),
	deleteCable: vi.fn().mockResolvedValue(undefined),
	getConduitsForCable: vi.fn(() => ({ current: [], loading: false, error: undefined })),
	getCableSplices: vi.fn().mockResolvedValue([]),
	recalculateCableLength: vi.fn().mockResolvedValue({ length: 0, length_total: 0 })
}));
vi.mock('$lib/remote/network-schema/nodes.remote', () => ({
	getNodeDetails: vi.fn().mockResolvedValue({}),
	saveNodeGeometry: vi.fn().mockResolvedValue({}),
	getNodeDependencies: vi.fn(() => ({
		loading: false,
		error: undefined,
		current: {
			cables: [],
			structures: [],
			children: [],
			childrenWithCables: [],
			hasChildren: false,
			hasCables: false,
			hasChildrenWithCables: false
		}
	})),
	updateNode: vi.fn().mockResolvedValue({}),
	deleteNode: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/remote/network-schema/micropipes.remote', () => ({
	autoLinkMicropipe: vi.fn().mockResolvedValue({ results: [], linked_count: 0 }),
	getMicropipeConnectionsForCable: vi.fn().mockResolvedValue([]),
	getLinkedTrenchesForCable: vi.fn().mockResolvedValue([]),
	getConduitsByTrenches: vi.fn().mockResolvedValue([]),
	getMicropipesByConduits: vi.fn().mockResolvedValue([]),
	createMicropipeConnections: vi.fn().mockResolvedValue(undefined),
	deleteMicropipeConnections: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/remote/network-schema/component-types.remote', () => ({
	getComponentTypes: vi.fn(() => ({ current: [], loading: false, error: undefined }))
}));
vi.mock('$lib/remote/network-schema/node-structures.remote', () => ({
	getSlotConfigurationsForNode: vi.fn().mockResolvedValue([]),
	getSlotDividers: vi.fn().mockResolvedValue([]),
	getSlotClipNumbers: vi.fn().mockResolvedValue([]),
	createNodeStructure: vi.fn().mockResolvedValue({}),
	bulkCreateNodeStructures: vi.fn().mockResolvedValue({ created: [], failed: [] }),
	moveNodeStructure: vi.fn().mockResolvedValue({}),
	deleteNodeStructure: vi.fn().mockResolvedValue(undefined),
	createSlotDivider: vi.fn().mockResolvedValue({}),
	deleteSlotDivider: vi.fn().mockResolvedValue(undefined),
	upsertSlotClipNumber: vi.fn().mockResolvedValue({})
}));
vi.mock('$lib/remote/network-schema/fiber-splices.remote', () => ({
	getComponentPorts: vi.fn().mockResolvedValue([]),
	getFiberSplices: vi.fn().mockResolvedValue([]),
	upsertFiberSplice: vi.fn().mockResolvedValue({}),
	bulkUpsertFiberSplices: vi.fn().mockResolvedValue({ created: [], failed: [] }),
	clearFiberSplice: vi.fn().mockResolvedValue({ deleted: 0 }),
	mergePorts: vi.fn().mockResolvedValue({}),
	unmergePorts: vi.fn().mockResolvedValue({}),
	upsertMergedSplice: vi.fn().mockResolvedValue({})
}));
vi.mock('$lib/remote/network-schema/fibers.remote', () => ({
	getCablesAtNode: vi.fn().mockResolvedValue([]),
	getFibersForCable: vi.fn().mockResolvedValue([]),
	getFiberColors: vi.fn().mockResolvedValue([]),
	getFiberUsageInNode: vi.fn().mockResolvedValue({ usedFiberUuids: [], fiberComponentMap: {} }),
	getAddressesForNode: vi.fn().mockResolvedValue([]),
	getUsedResidentialUnits: vi
		.fn()
		.mockResolvedValue({ usedResidentialUnitUuids: [], residentialUnitComponentMap: {} }),
	getFiberStatusOptions: vi.fn().mockResolvedValue([]),
	updateFiberStatus: vi.fn().mockResolvedValue(null)
}));
vi.mock('$lib/remote/network-schema/cable-connections.remote', () => ({
	getCableSplicesAtNode: vi.fn().mockResolvedValue([]),
	updateCableConnection: vi.fn().mockResolvedValue({}),
	deleteCableSplicesAtNode: vi.fn().mockResolvedValue({ deletedCount: 0, failedCount: 0 })
}));
vi.mock('$lib/remote/network-schema/containers.remote', () => ({
	getContainerTypes: vi.fn().mockResolvedValue([]),
	getContainerHierarchy: vi
		.fn()
		.mockResolvedValue({ containers: [], root_slot_configurations: [] }),
	getNodeStructures: vi.fn().mockResolvedValue([]),
	createContainer: vi.fn().mockResolvedValue({}),
	deleteContainer: vi.fn().mockResolvedValue(undefined),
	updateContainerName: vi.fn().mockResolvedValue({}),
	moveItem: vi.fn().mockResolvedValue(undefined),
	toggleContainerExpanded: vi.fn().mockResolvedValue(undefined),
	createSlotConfiguration: vi.fn().mockResolvedValue({}),
	updateSlotConfiguration: vi.fn().mockResolvedValue({}),
	deleteSlotConfiguration: vi.fn().mockResolvedValue(undefined),
	exportNodeExcel: vi.fn().mockResolvedValue({ fileData: '', fileName: 'x.xlsx' })
}));

vi.mock('$lib/remote/address/addresses.remote', () => ({
	getAddressList: vi.fn().mockResolvedValue({
		addresses: [],
		pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 }
	}),
	getAddress: vi.fn().mockResolvedValue({}),
	getAddressLinks: vi.fn().mockResolvedValue({ nodes: [], microducts: [] }),
	getLinkedTrenches: vi.fn().mockResolvedValue([]),
	getAddressFiberConnections: vi.fn().mockResolvedValue({}),
	updateAddress: vi.fn().mockResolvedValue({}),
	regenerateAddressId: vi.fn().mockResolvedValue({}),
	deleteAddress: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/remote/address/attribute-options.remote', () => ({
	getStatusDevelopmentOptions: vi.fn().mockResolvedValue([]),
	getFlagOptions: vi.fn().mockResolvedValue([]),
	getResidentialUnitTypeOptions: vi.fn().mockResolvedValue([]),
	getResidentialUnitStatusOptions: vi.fn().mockResolvedValue([])
}));
/**
 * Inert stand-in for a remote `command` call: resolves to `value` both when
 * awaited directly and through `.updates(...)`.
 * @param {unknown} value
 */
function commandStub(value) {
	const promise = Promise.resolve(value);
	return Object.assign(promise, { updates: () => promise });
}

/**
 * Inert stand-in for a remote `query` instance: resolves to `value` and
 * accepts `withOverride(...)` without applying it.
 * @param {unknown} value
 */
function queryStub(value) {
	return Object.assign(Promise.resolve(value), { withOverride: () => () => undefined });
}

/**
 * Inert stand-in for a remote `form`: spreadable onto `<form>`, with fields
 * whose `as()` yields plain input attributes.
 * @param {string} name
 * @param {string[]} fieldNames
 */
function formStub(name, fieldNames) {
	const fields = Object.fromEntries(
		fieldNames.map((field) => [
			field,
			{
				as: (type) => ({ name: field, type: type === 'hidden' ? 'hidden' : type }),
				issues: () => undefined,
				value: () => ''
			}
		])
	);
	fields.allIssues = () => undefined;
	const attributes = { method: 'POST', action: `/_app/remote/stub/${name}` };
	return {
		...attributes,
		fields,
		pending: 0,
		result: undefined,
		submit: vi.fn(() => commandStub(true)),
		enhance: vi.fn(() => attributes)
	};
}

vi.mock('$lib/remote/auth/login.remote', () => ({
	login: formStub('login', ['username', '_password', 'redirectTo'])
}));
vi.mock('$lib/remote/auth/logout.remote', () => ({
	logout: formStub('logout', [])
}));
vi.mock('$lib/remote/dashboard/statistics.remote', () => ({
	getDashboardStatistics: vi.fn().mockResolvedValue({})
}));
vi.mock('$lib/remote/admin/logs.remote', () => ({
	getLogs: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] })
}));
vi.mock('$lib/remote/conduit/conduits.remote', () => ({
	getConduitList: vi.fn().mockResolvedValue({
		conduits: [],
		pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 }
	}),
	getConduit: vi.fn().mockResolvedValue({ uuid: '', name: '' }),
	createConduit: vi.fn(() => commandStub({ uuid: '', name: '' })),
	updateConduit: vi.fn(() => commandStub({ uuid: '', name: '' })),
	deleteConduit: vi.fn(() => commandStub(undefined)),
	importConduits: formStub('importConduits', ['file'])
}));
vi.mock('$lib/remote/conduit/attribute-options.remote', () => ({
	getConduitTypeOptions: vi.fn().mockResolvedValue([]),
	getStatusOptions: vi.fn().mockResolvedValue([]),
	getNetworkLevelOptions: vi.fn().mockResolvedValue([]),
	getCompanyOptions: vi.fn().mockResolvedValue([]),
	getFlagOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('$lib/remote/conduit/microducts.remote', () => ({
	getMicroducts: vi.fn().mockResolvedValue([]),
	getMicroductStatusOptions: vi.fn().mockResolvedValue([]),
	updateMicroductStatus: vi.fn(() => commandStub({ uuid: '' }))
}));
vi.mock('$lib/remote/house-connections/node-assignment.remote', () => ({
	assignNodeToMicroduct: vi.fn(() => commandStub({ uuid: '' })),
	removeNodeFromMicroduct: vi.fn(() => commandStub({ uuid: '' }))
}));
vi.mock('$lib/remote/pipe-branch/branches.remote', () => ({
	getPipeBranches: vi.fn().mockResolvedValue({ branches: [], configured: false })
}));
vi.mock('$lib/remote/pipe-branch/trench-selections.remote', () => ({
	getTrenchesNearNode: vi.fn().mockResolvedValue({
		trenches: [],
		count: 0,
		node_uuid: '',
		node_name: '',
		distance: 0,
		project_id: 0
	}),
	getTrenchSelections: vi.fn().mockResolvedValue([]),
	saveTrenchSelections: vi.fn(() => commandStub(undefined))
}));
vi.mock('$lib/remote/pipe-branch/connections.remote', () => ({
	getConnections: vi.fn(() => queryStub([])),
	createConnections: vi.fn(() => commandStub({ created: 0, errors: [] })),
	deleteConnection: vi.fn(() => commandStub(undefined))
}));
vi.mock('$lib/remote/trench/conduit-options.remote', () => ({
	getConduitOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('$lib/remote/trench/connections.remote', () => ({
	getTrenchConnections: vi.fn(() => queryStub([])),
	createTrenchConnections: vi.fn(() => commandStub({ created: 0 })),
	deleteTrenchConnection: vi.fn(() => commandStub(undefined))
}));
vi.mock('$lib/remote/trench/routing.remote', () => ({
	calculateRoute: vi.fn().mockResolvedValue({ pathWkt: '', trenches: [] }),
	getTrenchGeometry: vi
		.fn()
		.mockResolvedValue({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } })
}));
vi.mock('$lib/remote/map/feature-search.remote', () => ({
	searchFeatures: vi.fn().mockResolvedValue([]),
	getFeatureDetails: vi.fn().mockResolvedValue({ id: '', properties: {} }),
	getConduitTrenches: vi.fn().mockResolvedValue({ trenches: [], trenchUuids: [] })
}));
vi.mock('$lib/remote/map/trenches.remote', () => ({
	getConduitsInTrench: vi.fn().mockResolvedValue([]),
	getCablesInTrench: vi.fn().mockResolvedValue([]),
	getTrenchProfile: vi.fn().mockResolvedValue([]),
	saveTrenchProfilePosition: vi.fn(() => commandStub(undefined))
}));
vi.mock('$lib/remote/map/layers.remote', () => ({
	getLayerExtent: vi.fn().mockResolvedValue({ extent: null, layer: '' }),
	getLayerStyleAttributes: vi
		.fn()
		.mockResolvedValue({ nodeTypes: [], surfaces: [], constructionTypes: [], areaTypes: [] })
}));
vi.mock('$lib/remote/fault-simulation/simulation.remote', () => ({
	simulateFault: vi.fn().mockResolvedValue({
		trench: null,
		conduits: [],
		cables: [],
		affected_addresses_details: []
	})
}));
vi.mock('$lib/remote/pipeline-records/records.remote', () => ({
	getPipelineRecordList: vi.fn().mockResolvedValue({
		records: [],
		pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 }
	}),
	getPipelineRecord: vi.fn().mockResolvedValue({ uuid: '' }),
	createPipelineRecord: vi.fn(() => commandStub({ uuid: '' })),
	updatePipelineRecord: vi.fn(() => commandStub({ uuid: '' })),
	deletePipelineRecord: vi.fn(() => commandStub(undefined))
}));
vi.mock('$lib/remote/pipeline-records/record-options.remote', () => ({
	getTypeOfWorkOptions: vi.fn().mockResolvedValue([]),
	getRequestReasonOptions: vi.fn().mockResolvedValue([])
}));
vi.mock('$lib/remote/pipeline-records/inquiry-areas.remote', () => ({
	getInquiryAreas: vi.fn(() => queryStub([])),
	createInquiryArea: vi.fn(() => commandStub(undefined)),
	updateInquiryAreaGeometry: vi.fn(() => commandStub(undefined)),
	renameInquiryArea: vi.fn(() => commandStub(undefined)),
	deleteInquiryArea: vi.fn(() => commandStub(undefined))
}));
vi.mock('$lib/remote/valuation/valuation.remote', () => ({
	getValuationAreas: vi.fn().mockResolvedValue([]),
	getValuationRateCount: vi.fn().mockResolvedValue(0),
	calculateValuation: vi.fn().mockResolvedValue({
		categories: [],
		total: 0,
		costPerHouseConnection: null,
		costPerMeter: null
	})
}));
vi.mock('$lib/remote/post-compaction/address-search.remote', () => ({
	searchAddresses: vi.fn().mockResolvedValue([])
}));
vi.mock('$lib/remote/address/residential-units.remote', () => ({
	getResidentialUnits: vi.fn().mockResolvedValue([]),
	getResidentialUnit: vi.fn().mockResolvedValue({}),
	getUnitFiberConnections: vi.fn().mockResolvedValue([]),
	createResidentialUnit: vi.fn().mockResolvedValue({}),
	updateResidentialUnit: vi.fn().mockResolvedValue({}),
	deleteResidentialUnit: vi.fn().mockResolvedValue(undefined),
	regenerateResidentialUnitId: vi.fn().mockResolvedValue({})
}));

// jsdom does not provide ResizeObserver (required by @zag-js/tabs / Skeleton Tabs)
global.ResizeObserver = class ResizeObserver {
	constructor() {}
	observe() {}
	unobserve() {}
	disconnect() {}
};

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// add more mocks here if you need them
