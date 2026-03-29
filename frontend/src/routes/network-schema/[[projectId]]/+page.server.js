import { error, fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
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
	getUsedResidentialUnits,
	mapNodesToOptions
} from '$lib/server/nodeData';

/**
 * Poll for sync completion with timeout and progress updates
 * @param {Function} fetch - SvelteKit fetch function
 * @param {Record<string, string> | Headers} headers - Auth headers
 * @param {Record<string, any> & {sync_in_progress: boolean}} initialStatus - Initial sync status
 * @param {number} maxWaitTimeMs - Maximum wait time in milliseconds
 * @param {string} projectId - Project ID
 * @returns {Promise<Record<string, any> & {sync_in_progress: boolean}>} Final sync status
 */
export async function _waitForSyncCompletion(
	fetch,
	headers,
	initialStatus,
	maxWaitTimeMs = 30000,
	projectId
) {
	const startTime = Date.now();
	const pollInterval = 2000;
	let currentStatus = initialStatus;

	while (currentStatus.sync_in_progress && Date.now() - startTime < maxWaitTimeMs) {
		await new Promise((resolve) => setTimeout(resolve, pollInterval));

		try {
			const response = await fetch(`${API_URL}canvas-coordinates/?project_id=${projectId}`, {
				credentials: 'include',
				headers: headers
			});

			if (response.ok) {
				currentStatus = await response.json();
				if (!currentStatus.sync_in_progress) {
					break;
				}
			} else {
				console.warn('Failed to check sync status during polling');
				break;
			}
		} catch (error) {
			console.error('Error polling sync status:', error);
			break;
		}
	}

	if (currentStatus.sync_in_progress && Date.now() - startTime >= maxWaitTimeMs) {
		console.warn('Sync polling timed out - proceeding with current data');
	}

	return currentStatus;
}

/**
 * Loads network schema page data including nodes, cables, attribute options, and sync status.
 * Triggers canvas coordinate sync if needed and waits for completion before returning.
 * @param {import('./$types').PageServerLoadEvent} event - SvelteKit page server load event.
 * @returns {Promise<Record<string, any>>} Page data with nodes, cables, attribute lists, and sync status.
 */
export async function load({ fetch, cookies, url, params }) {
	const headers = getAuthHeaders(cookies);
	const projectId = params.projectId;

	if (!projectId) {
		return {
			nodes: [],
			cables: [],
			cableTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: [],
			syncStatus: null,
			parentNodeOptions: []
		};
	}

	try {
		const attributesFetchPromise = Promise.all([
			fetch(`${API_URL}attributes_cable_type/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_node_type/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_status/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_network_level/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_company/`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}flags/`, {
				credentials: 'include',
				headers: headers
			})
		]);

		let syncStatus = null;

		const syncStatusResponse = await fetch(
			`${API_URL}canvas-coordinates/?project_id=${projectId}`,
			{
				credentials: 'include',
				headers: headers
			}
		);

		if (!syncStatusResponse.ok) {
			console.warn('Failed to check canvas sync status');
		} else {
			syncStatus = await syncStatusResponse.json();

			if (syncStatus.sync_in_progress) {
				syncStatus = await _waitForSyncCompletion(fetch, headers, syncStatus, 30000, projectId);
			} else if (syncStatus.sync_needed) {
				const syncResponse = await fetch(`${API_URL}canvas-coordinates/`, {
					method: 'POST',
					credentials: 'include',
					headers: {
						...headers,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						project_id: projectId,
						scale: 0.5
					})
				});

				if (syncResponse.status === 409) {
					const conflictData = await syncResponse.json();
				} else if (!syncResponse.ok) {
					console.error('Failed to sync canvas coordinates');
				} else {
					const syncResult = await syncResponse.json();
				}
			}
		}

		const [
			[
				cableTypeResponse,
				nodeTypeResponse,
				statusResponse,
				networkLevelResponse,
				companyResponse,
				flagsResponse
			],
			nodeResponse,
			cableResponse,
			cableLabelResponse,
			cableMicropipeResponse
		] = await Promise.all([
			attributesFetchPromise,
			fetch(`${API_URL}node/all/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}cable/all/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}cable_label/all/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}cables/micropipe-summary/${projectId}/`, {
				credentials: 'include',
				headers: headers
			})
		]);

		if (!nodeResponse.ok) {
			throw error(500, 'Failed to fetch nodes');
		}

		const nodesData = await nodeResponse.json();
		const networkSchemaSettingsConfigured = nodesData?.metadata?.settings_configured ?? false;
		const excludedNodeTypeIds = nodesData?.metadata?.excluded_node_type_ids ?? [];
		const childViewEnabledNodeTypeIds = nodesData?.metadata?.child_view_enabled_node_type_ids ?? [];

		let cablesData = [];
		let cableLabelsData = [];
		let cableMicropipeConnections = {};
		let cableTypesData = [];
		let nodeTypesData = [];
		let statusData = [];
		let networkLevelData = [];
		let companyData = [];
		let flagsData = [];

		if (cableResponse.ok) {
			cablesData = await cableResponse.json();
		} else {
			console.warn('Failed to fetch cables, continuing without them');
		}

		if (cableLabelResponse.ok) {
			cableLabelsData = await cableLabelResponse.json();
		} else {
			console.warn('Failed to fetch cable labels, continuing without them');
		}

		if (cableMicropipeResponse.ok) {
			cableMicropipeConnections = await cableMicropipeResponse.json();
		} else {
			console.warn('Failed to fetch cable micropipe connections, continuing without them');
		}

		/** @type {Record<string, any[]>} */
		const cableLabelMap = {};
		cableLabelsData.forEach((/** @type {any} */ label) => {
			const cableUuid = label.cable?.uuid || label.cable;
			if (!cableLabelMap[cableUuid]) {
				cableLabelMap[cableUuid] = [];
			}
			cableLabelMap[cableUuid].push(label);
		});

		cablesData = cablesData.map((/** @type {any} */ cable) => {
			const cableUuid = cable.uuid || (cable.cable && cable.cable.uuid) || cable.cable;
			return {
				...cable,
				uuid: cableUuid,
				labelData: cableLabelMap[cableUuid]?.[0] || null
			};
		});

		if (cableTypeResponse.ok) {
			cableTypesData = await cableTypeResponse.json();
			cableTypesData = cableTypesData.map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.cable_type
			}));
		} else {
			console.warn('Failed to fetch cable types, continuing without them');
		}

		if (nodeTypeResponse.ok) {
			nodeTypesData = await nodeTypeResponse.json();
			nodeTypesData = nodeTypesData.map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.node_type
			}));
		} else {
			console.warn('Failed to fetch node types data, continuing without it');
		}

		if (statusResponse.ok) {
			statusData = await statusResponse.json();
			statusData = statusData.map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.status
			}));
		} else {
			console.warn('Failed to fetch status data, continuing without it');
		}

		if (networkLevelResponse.ok) {
			networkLevelData = await networkLevelResponse.json();
			networkLevelData = networkLevelData.map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.network_level
			}));
		} else {
			console.warn('Failed to fetch network level data, continuing without it');
		}

		if (companyResponse.ok) {
			companyData = await companyResponse.json();
			companyData = companyData.map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.company
			}));
		} else {
			console.warn('Failed to fetch company data, continuing without it');
		}

		if (flagsResponse.ok) {
			flagsData = await flagsResponse.json();
			flagsData = flagsData.map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.flag
			}));
		} else {
			console.warn('Failed to fetch flags data, continuing without it');
		}

		const parentNodeOptions = mapNodesToOptions(nodesData);

		return {
			nodes: nodesData,
			cables: cablesData,
			cableMicropipeConnections,
			cableTypes: cableTypesData,
			nodeTypes: nodeTypesData,
			statuses: statusData,
			networkLevels: networkLevelData,
			companies: companyData,
			flags: flagsData,
			syncStatus: syncStatus || null,
			networkSchemaSettingsConfigured,
			excludedNodeTypeIds,
			childViewEnabledNodeTypeIds,
			parentNodeOptions
		};
	} catch (err) {
		const typedErr = /** @type {any} */ (err);
		if (typedErr.status === 500 && typedErr.message === 'Failed to fetch nodes') {
			throw err;
		}

		console.error('Error loading network schema page:', err);
		return {
			nodes: [],
			cables: [],
			cableMicropipeConnections: {},
			cableTypes: [],
			nodeTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: [],
			syncStatus: null,
			networkSchemaSettingsConfigured: false,
			excludedNodeTypeIds: [],
			childViewEnabledNodeTypeIds: [],
			parentNodeOptions: []
		};
	}
}

/**
 * SvelteKit form actions for the network schema page.
 * Handles CRUD operations for cables, nodes, slot configurations, containers,
 * node structures, fiber splices, micropipe connections, and related entities.
 * @type {import('./$types').Actions}
 */
export const actions = {
	createCable: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const uuid = formData.get('uuid');
			const name = formData.get('name');
			const cable_type_id = formData.get('cable_type_id');
			const project_id = formData.get('project_id');
			const flag_id = formData.get('flag_id');
			const uuid_node_start_id = formData.get('uuid_node_start_id');
			const uuid_node_end_id = formData.get('uuid_node_end_id');
			const handle_start = formData.get('handle_start');
			const handle_end = formData.get('handle_end');
			const parent_node_context_id = formData.get('parent_node_context_id');

			if (!name || !cable_type_id || !project_id || !flag_id) {
				return fail(400, {
					error:
						'Missing required fields: name, cable_type_id, project_id, and flag_id are required'
				});
			}

			if (!uuid_node_start_id || !uuid_node_end_id) {
				return fail(400, {
					error: 'Missing required fields: uuid_node_start_id and uuid_node_end_id are required'
				});
			}

			const headers = new Headers({
				'Content-Type': 'application/json'
			});

			const accessToken = cookies.get('api-access-token');
			if (accessToken) {
				headers.append('Cookie', `api-access-token=${accessToken}`);
			}

			const backendUrl = `${API_URL}cable/`;

			/** @type {Record<string, any>} */
			const requestBody = {
				name,
				cable_type_id: parseInt(String(cable_type_id)),
				project_id: parseInt(String(project_id)),
				flag_id: parseInt(String(flag_id)),
				uuid_node_start_id: uuid_node_start_id,
				uuid_node_end_id: uuid_node_end_id
			};

			if (uuid) requestBody.uuid = uuid;
			if (handle_start) requestBody.handle_start = handle_start;
			if (handle_end) requestBody.handle_end = handle_end;
			if (parent_node_context_id) requestBody.parent_node_context_id = parent_node_context_id;

			const response = await fetch(backendUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorData;

				try {
					errorData = JSON.parse(errorText);
				} catch {
					errorData = { error: errorText || `Request failed with status: ${response.status}` };
				}

				return fail(response.status, errorData);
			}

			const cable = await response.json();
			return { type: 'success', data: cable };
		} catch (error) {
			console.error('Cable POST action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getCables: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const uuid = formData.get('uuid');

			if (!uuid) {
				return fail(400, {
					error: 'Missing required parameter: uuid is required'
				});
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}cable/${uuid}`;

			const response = await fetch(backendUrl, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorData;

				try {
					errorData = JSON.parse(errorText);
				} catch {
					errorData = { error: errorText || `Request failed with status: ${response.status}` };
				}

				return fail(response.status, errorData);
			}

			const cables = await response.json();
			return cables;
		} catch (error) {
			console.error('Cable GET action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},
	updateCable: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const cableId = formData.get('uuid');
		const name = formData.get('cable_name');
		const cable_type_id = formData.get('cable_type_id');
		const status_id = formData.get('status_id');
		const network_level_id = formData.get('network_level_id');
		const owner_id = formData.get('owner_id');
		const constructor_id = formData.get('constructor_id');
		const manufacturer_id = formData.get('manufacturer_id');
		const flag_id = formData.get('flag_id');
		const date = formData.get('date');
		const reserve_at_start = formData.get('reserve_at_start');
		const reserve_at_end = formData.get('reserve_at_end');
		const reserve_section = formData.get('reserve_section');
		const handle_start = formData.get('handle_start');
		const handle_end = formData.get('handle_end');

		if (!cableId) {
			return {
				type: 'error',
				message: 'Cable ID is required'
			};
		}

		try {
			/** @type {Record<string, any>} */
			const requestBody = {};

			if (name) requestBody.name = name;
			if (cable_type_id) requestBody.cable_type_id = parseInt(String(cable_type_id));
			if (status_id) requestBody.status_id = parseInt(String(status_id));
			if (network_level_id) requestBody.network_level_id = parseInt(String(network_level_id));
			if (owner_id) requestBody.owner_id = parseInt(String(owner_id));
			if (constructor_id) requestBody.constructor_id = parseInt(String(constructor_id));
			if (manufacturer_id) requestBody.manufacturer_id = parseInt(String(manufacturer_id));
			if (flag_id) requestBody.flag_id = parseInt(String(flag_id));
			if (date) requestBody.date = date;
			if (reserve_at_start) requestBody.reserve_at_start = parseInt(String(reserve_at_start));
			if (reserve_at_end) requestBody.reserve_at_end = parseInt(String(reserve_at_end));
			if (reserve_section) requestBody.reserve_section = parseInt(String(reserve_section));
			if (handle_start) requestBody.handle_start = handle_start;
			if (handle_end) requestBody.handle_end = handle_end;

			const response = await fetch(`${API_URL}cable/${cableId}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.detail || `Failed to update cable`;
				console.error('Error updating cable:', errorMessage);
				return fail(response.status, { message: errorMessage });
			}

			const updatedCable = await response.json();

			return {
				success: true,
				message: 'Cable updated successfully',
				cable: updatedCable
			};
		} catch (err) {
			console.error('Error updating cable:', err);
			return fail(500, { message: /** @type {Error} */ (err).message || 'Failed to update cable' });
		}
	},
	deleteCable: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const cableId = formData.get('uuid');

		if (!cableId) {
			return fail(400, { message: 'Cable ID is required' });
		}

		try {
			const response = await fetch(`${API_URL}cable/${cableId}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers: headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.detail || `Failed to delete cable`;
				console.error('Error deleting cable:', errorMessage);
				return fail(response.status, { message: errorMessage });
			}

			return {
				success: true,
				message: 'Cable deleted successfully'
			};
		} catch (err) {
			console.error('Error deleting cable:', err);
			return fail(500, { message: /** @type {Error} */ (err).message || 'Failed to delete cable' });
		}
	},
	saveCableGeometry: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const cableId = formData.get('cableId');
		const diagramPathJson = formData.get('diagram_path');

		if (!cableId) {
			return {
				type: 'error',
				message: 'Cable ID is required'
			};
		}

		let diagram_path = null;
		if (diagramPathJson) {
			try {
				diagram_path = JSON.parse(String(diagramPathJson));
			} catch (e) {
				return {
					type: 'error',
					message: 'Invalid diagram path format'
				};
			}
		}

		try {
			const response = await fetch(`${API_URL}cable/${cableId}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					diagram_path
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.detail || `HTTP ${response.status}: Failed to update cable path`);
			}

			const updatedCable = await response.json();

			return {
				type: 'success',
				message: 'Cable path saved successfully',
				cable: updatedCable
			};
		} catch (err) {
			console.error('Error saving cable geometry:', err);
			return {
				type: 'error',
				message: /** @type {Error} */ (err).message || 'Failed to save cable path'
			};
		}
	},
	getNodes: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const uuid = formData.get('uuid');

			if (!uuid) {
				return fail(400, {
					error: 'Missing required parameter: uuid is required'
				});
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}node/${uuid}`;

			const response = await fetch(backendUrl, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorData;

				try {
					errorData = JSON.parse(errorText);
				} catch {
					errorData = { error: errorText || `Request failed with status: ${response.status}` };
				}

				return fail(response.status, errorData);
			}

			const nodes = await response.json();
			return nodes;
		} catch (error) {
			console.error('Node GET action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},
	updateNode: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const nodeId = formData.get('uuid');
		const name = formData.get('node_name');
		const node_type_id = formData.get('node_type_id');
		const status_id = formData.get('status_id');
		const network_level_id = formData.get('network_level_id');
		const owner_id = formData.get('owner_id');
		const constructor_id = formData.get('constructor_id');
		const manufacturer_id = formData.get('manufacturer_id');
		const warranty = formData.get('warranty');
		const date = formData.get('date');
		const flag_id = formData.get('flag_id');
		const parent_node_id = formData.get('parent_node_id');

		if (!nodeId) {
			return {
				type: 'error',
				message: 'Node ID is required'
			};
		}

		try {
			/** @type {Record<string, any>} */
			const requestBody = {};

			if (name) requestBody.name = name;
			if (node_type_id) requestBody.node_type_id = parseInt(String(node_type_id));
			if (status_id) requestBody.status_id = parseInt(String(status_id));
			if (network_level_id) requestBody.network_level_id = parseInt(String(network_level_id));
			if (owner_id) requestBody.owner_id = parseInt(String(owner_id));
			if (constructor_id) requestBody.constructor_id = parseInt(String(constructor_id));
			if (manufacturer_id) requestBody.manufacturer_id = parseInt(String(manufacturer_id));
			if (flag_id) requestBody.flag_id = parseInt(String(flag_id));
			if (date) requestBody.date = date;
			if (warranty) requestBody.warranty = warranty;
			if (parent_node_id) {
				requestBody.parent_node_id = parent_node_id;
			} else {
				requestBody.parent_node_id = null;
			}

			const response = await fetch(`${API_URL}node/${nodeId}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.detail || `Failed to update node`;
				console.error('Error updating node:', errorMessage);
				return fail(response.status, { message: errorMessage });
			}

			const updatedNode = await response.json();

			return {
				success: true,
				message: 'Node updated successfully',
				node: updatedNode
			};
		} catch (err) {
			console.error('Error updating node:', err);
			return fail(500, { message: /** @type {Error} */ (err).message || 'Failed to update node' });
		}
	},
	deleteNode: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const nodeId = formData.get('uuid');

		if (!nodeId) {
			return {
				type: 'error',
				message: 'Node ID is required'
			};
		}

		try {
			const response = await fetch(`${API_URL}node/${nodeId}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to delete node'
				});
			}

			return {
				type: 'success',
				message: 'Node deleted successfully'
			};
		} catch (err) {
			console.error('Error deleting node:', err);
			return fail(500, { message: /** @type {Error} */ (err).message || 'Failed to delete node' });
		}
	},
	getNodeDependencies: async ({ request, fetch, cookies, params }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const nodeId = formData.get('nodeUuid');
		const projectId = params.projectId;

		if (!nodeId) {
			return fail(400, { error: 'Node ID is required' });
		}

		try {
			const cablesResponse = await fetch(`${API_URL}cable/at-node/${nodeId}/`, {
				method: 'GET',
				headers
			});

			let cables = [];
			if (cablesResponse.ok) {
				cables = await cablesResponse.json();
			}

			const structuresResponse = await fetch(`${API_URL}node-structure/?node=${nodeId}`, {
				method: 'GET',
				headers
			});

			let structures = [];
			if (structuresResponse.ok) {
				structures = await structuresResponse.json();
			}

			let children = [];
			let childrenWithCables = [];
			if (projectId) {
				const childrenResponse = await fetch(
					`${API_URL}node/?parent_node=${nodeId}&project=${projectId}`,
					{ method: 'GET', headers }
				);

				if (childrenResponse.ok) {
					const childrenData = await childrenResponse.json();
					children =
						childrenData.results?.features ||
						childrenData.features ||
						(Array.isArray(childrenData) ? childrenData : []);

					for (const child of children) {
						const childId = child.id || child.properties?.uuid || child.uuid;
						const childName = child.properties?.name || child.name;
						const childCablesResponse = await fetch(`${API_URL}cable/at-node/${childId}/`, {
							method: 'GET',
							headers
						});
						if (childCablesResponse.ok) {
							const childCables = await childCablesResponse.json();
							if (childCables.length > 0) {
								childrenWithCables.push({
									nodeId: childId,
									nodeName: childName,
									cableCount: childCables.length
								});
							}
						}
					}
				}
			}

			return {
				cables: cables || [],
				structures: structures || [],
				children: children || [],
				childrenWithCables: childrenWithCables || [],
				hasChildren: children.length > 0,
				hasCables: cables.length > 0,
				hasChildrenWithCables: childrenWithCables.length > 0
			};
		} catch (err) {
			console.error('Error fetching node dependencies:', err);
			return fail(500, { error: 'Failed to fetch node dependencies' });
		}
	},
	getCableSplices: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableUuid = formData.get('cableUuid');

		if (!cableUuid) {
			return fail(400, { error: 'Cable UUID is required' });
		}

		try {
			const splicesAResponse = await fetch(`${API_URL}fiber-splice/?cable_a=${cableUuid}`, {
				method: 'GET',
				headers
			});

			const splicesBResponse = await fetch(`${API_URL}fiber-splice/?cable_b=${cableUuid}`, {
				method: 'GET',
				headers
			});

			let splicesA = [];
			let splicesB = [];
			if (splicesAResponse.ok) {
				splicesA = await splicesAResponse.json();
			}
			if (splicesBResponse.ok) {
				splicesB = await splicesBResponse.json();
			}

			const spliceMap = new Map();
			[...splicesA, ...splicesB].forEach((splice) => {
				if (splice.uuid) {
					spliceMap.set(splice.uuid, splice);
				}
			});
			const splices = Array.from(spliceMap.values());

			return {
				splices: splices || [],
				connectedFiberCount: splices.length
			};
		} catch (err) {
			console.error('Error fetching cable splices:', err);
			return fail(500, { error: 'Failed to fetch cable splices' });
		}
	},
	saveNodeGeometry: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const nodeId = formData.get('nodeId');
		const canvas_x_raw = formData.get('canvas_x');
		const canvas_y_raw = formData.get('canvas_y');
		const child_canvas_x_raw = formData.get('child_canvas_x');
		const child_canvas_y_raw = formData.get('child_canvas_y');

		if (!nodeId) {
			return {
				type: 'error',
				message: 'Node ID is required'
			};
		}

		/** @type {Record<string, any>} */
		const updatePayload = {};

		if (canvas_x_raw != null && canvas_y_raw != null) {
			const canvas_x = parseFloat(String(canvas_x_raw));
			const canvas_y = parseFloat(String(canvas_y_raw));
			if (isNaN(canvas_x) || isNaN(canvas_y)) {
				return {
					type: 'error',
					message: 'Invalid canvas coordinates'
				};
			}
			updatePayload.canvas_x = canvas_x;
			updatePayload.canvas_y = canvas_y;
		}

		if (child_canvas_x_raw != null && child_canvas_y_raw != null) {
			const child_canvas_x = parseFloat(String(child_canvas_x_raw));
			const child_canvas_y = parseFloat(String(child_canvas_y_raw));
			if (isNaN(child_canvas_x) || isNaN(child_canvas_y)) {
				return {
					type: 'error',
					message: 'Invalid child canvas coordinates'
				};
			}
			updatePayload.child_canvas_x = child_canvas_x;
			updatePayload.child_canvas_y = child_canvas_y;
		}

		if (Object.keys(updatePayload).length === 0) {
			return {
				type: 'error',
				message: 'No valid coordinates provided'
			};
		}

		try {
			const response = await fetch(`${API_URL}node/${nodeId}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updatePayload)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.detail || `HTTP ${response.status}: Failed to update node position`
				);
			}

			const updatedNode = await response.json();

			return {
				type: 'success',
				message: 'Node position saved successfully',
				node: updatedNode
			};
		} catch (err) {
			console.error('Error saving node geometry:', err);
			return {
				type: 'error',
				message: /** @type {Error} */ (err).message || 'Failed to save node position'
			};
		}
	},
	getSlotConfigurations: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeUuid = formData.get('nodeUuid');

			if (!nodeUuid) {
				return fail(400, { error: 'Missing required parameter: nodeUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-slot-configuration/by-node/${nodeUuid}/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch slot configurations'
				});
			}

			const configurations = await response.json();
			return { configurations };
		} catch (err) {
			console.error('Error fetching slot configurations:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	createSlotConfiguration: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeUuid = formData.get('nodeUuid');
			const side = formData.get('side');
			const totalSlots = formData.get('totalSlots');

			if (!nodeUuid || !side || !totalSlots) {
				return fail(400, {
					error: 'Missing required fields: nodeUuid, side, and totalSlots are required'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-slot-configuration/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					uuid_node_id: nodeUuid,
					side: side,
					total_slots: parseInt(String(totalSlots))
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to create slot configuration'
				});
			}

			const configuration = await response.json();
			return { success: true, configuration };
		} catch (err) {
			console.error('Error creating slot configuration:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	updateSlotConfiguration: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const configUuid = formData.get('configUuid');
			const side = formData.get('side');
			const totalSlots = formData.get('totalSlots');

			if (!configUuid) {
				return fail(400, { error: 'Missing required parameter: configUuid' });
			}

			const headers = getAuthHeaders(cookies);
			/** @type {Record<string, any>} */
			const requestBody = {};
			if (side) requestBody.side = side;
			if (totalSlots) requestBody.total_slots = parseInt(String(totalSlots));

			const response = await fetch(`${API_URL}node-slot-configuration/${configUuid}/`, {
				method: 'PATCH',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to update slot configuration'
				});
			}

			const configuration = await response.json();
			return { success: true, configuration };
		} catch (err) {
			console.error('Error updating slot configuration:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	deleteSlotConfiguration: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const configUuid = formData.get('configUuid');

			if (!configUuid) {
				return fail(400, { error: 'Missing required parameter: configUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-slot-configuration/${configUuid}/`, {
				method: 'DELETE',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to delete slot configuration'
				});
			}

			return { success: true };
		} catch (err) {
			console.error('Error deleting slot configuration:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getContainerTypes: async ({ fetch, cookies }) => {
		return getContainerTypes(fetch, cookies);
	},
	getContainerHierarchy: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getContainerHierarchy(fetch, cookies, String(nodeUuid));
	},
	createContainer: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeUuid = formData.get('nodeUuid');
			const containerTypeId = formData.get('containerTypeId');
			const name = formData.get('name');
			const parentContainerId = formData.get('parentContainerId');

			if (!nodeUuid || !containerTypeId) {
				return fail(400, {
					error: 'Missing required fields: nodeUuid and containerTypeId'
				});
			}

			const headers = getAuthHeaders(cookies);
			/** @type {Record<string, any>} */
			const requestBody = {
				uuid_node_id: nodeUuid,
				container_type_id: parseInt(String(containerTypeId))
			};

			if (name) requestBody.name = name;
			if (parentContainerId) requestBody.parent_container_id = parentContainerId;

			const response = await fetch(`${API_URL}container/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to create container'
				});
			}

			const container = await response.json();
			return { success: true, container };
		} catch (err) {
			console.error('Error creating container:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	deleteContainer: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const containerUuid = formData.get('containerUuid');

			if (!containerUuid) {
				return fail(400, { error: 'Missing required parameter: containerUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}container/${containerUuid}/`, {
				method: 'DELETE',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to delete container'
				});
			}

			return { success: true };
		} catch (err) {
			console.error('Error deleting container:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	updateContainerName: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const containerUuid = formData.get('containerUuid');
			const name = formData.get('name');

			if (!containerUuid) {
				return fail(400, { error: 'Missing required parameter: containerUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}container/${containerUuid}/`, {
				method: 'PATCH',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name: name || null })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to update container name'
				});
			}

			const container = await response.json();
			return { success: true, container };
		} catch (err) {
			console.error('Error updating container name:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	moveItem: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const itemType = formData.get('itemType');
			const itemUuid = formData.get('itemUuid');
			const targetContainerId = formData.get('targetContainerId') || null;

			if (!itemType || !itemUuid) {
				return fail(400, { error: 'Missing required parameters' });
			}

			const headers = getAuthHeaders(cookies);
			let endpoint;
			let body;

			if (itemType === 'container') {
				endpoint = `${API_URL}container/${itemUuid}/move/`;
				body = { parent_container_id: targetContainerId || null };
			} else if (itemType === 'slot_configuration') {
				endpoint = `${API_URL}node-slot-configuration/${itemUuid}/move-to-container/`;
				body = { container_id: targetContainerId || null };
			} else {
				return fail(400, { error: 'Invalid item type' });
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to move item'
				});
			}

			return { success: true };
		} catch (err) {
			console.error('Error moving item:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	toggleContainerExpanded: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const containerUuid = formData.get('containerUuid');

			if (!containerUuid) {
				return fail(400, { error: 'Missing containerUuid' });
			}

			const headers = getAuthHeaders(cookies);

			const getResponse = await fetch(`${API_URL}container/${containerUuid}/`, {
				method: 'GET',
				headers
			});

			if (!getResponse.ok) {
				return fail(getResponse.status, { error: 'Container not found' });
			}

			const container = await getResponse.json();

			const response = await fetch(`${API_URL}container/${containerUuid}/`, {
				method: 'PATCH',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					is_expanded: !container.is_expanded
				})
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to update container' });
			}

			return { success: true };
		} catch (err) {
			console.error('Error toggling container:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	updateCableLabel: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const labelId = formData.get('labelId');
		const cableId = formData.get('cableId');
		const text = formData.get('text');
		const position_x = formData.get('position_x');
		const position_y = formData.get('position_y');
		const order = formData.get('order');

		if (!cableId) {
			return {
				type: 'error',
				message: 'Cable ID is required'
			};
		}

		if (position_x === null || position_y === null) {
			return {
				type: 'error',
				message: 'Label position is required'
			};
		}

		try {
			let response;

			if (labelId) {
				response = await fetch(`${API_URL}cable_label/${labelId}/`, {
					method: 'PATCH',
					credentials: 'include',
					headers: {
						...headers,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						text: text,
						position_x: parseFloat(String(position_x)),
						position_y: parseFloat(String(position_y))
					})
				});
			} else {
				const existingLabelResponse = await fetch(`${API_URL}cable_label/?cable_uuid=${cableId}`, {
					method: 'GET',
					credentials: 'include',
					headers: headers
				});

				if (existingLabelResponse.ok) {
					const existingLabels = await existingLabelResponse.json();

					if (existingLabels && existingLabels.length > 0) {
						const existingLabel = existingLabels[0];
						response = await fetch(`${API_URL}cable_label/${existingLabel.uuid}/`, {
							method: 'PATCH',
							credentials: 'include',
							headers: {
								...headers,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								text: text,
								position_x: parseFloat(String(position_x)),
								position_y: parseFloat(String(position_y))
							})
						});
					} else {
						const requestBody = {
							cable_id: cableId,
							text: text || 'Label',
							position_x: parseFloat(String(position_x)),
							position_y: parseFloat(String(position_y)),
							order: order ? parseInt(String(order)) : 0
						};

						response = await fetch(`${API_URL}cable_label/`, {
							method: 'POST',
							credentials: 'include',
							headers: {
								...headers,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify(requestBody)
						});
					}
				} else {
					const requestBody = {
						cable_id: cableId,
						text: text || 'Label',
						position_x: parseFloat(String(position_x)),
						position_y: parseFloat(String(position_y)),
						order: order ? parseInt(String(order)) : 0
					};

					response = await fetch(`${API_URL}cable_label/`, {
						method: 'POST',
						credentials: 'include',
						headers: {
							...headers,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(requestBody)
					});
				}
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to update cable label'
				});
			}

			const updatedLabel = await response.json();

			return {
				type: 'success',
				message: labelId ? 'Label position updated successfully' : 'Label created successfully',
				label: updatedLabel
			};
		} catch (err) {
			console.error('Error saving cable label:', err);
			return fail(500, {
				message: /** @type {Error} */ (err).message || 'Failed to save cable label'
			});
		}
	},
	deleteCableLabel: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const labelId = formData.get('labelId');

		if (!labelId) {
			return {
				type: 'error',
				message: 'Label ID is required'
			};
		}

		try {
			const response = await fetch(`${API_URL}cable_label/${labelId}/`, {
				method: 'DELETE',
				credentials: 'include',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to delete cable label'
				});
			}

			return {
				type: 'success',
				message: 'Label deleted successfully'
			};
		} catch (err) {
			console.error('Error deleting cable label:', err);
			return fail(500, {
				message: /** @type {Error} */ (err).message || 'Failed to delete cable label'
			});
		}
	},
	getSlotConfigurationsForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getSlotConfigurationsForNode(fetch, cookies, String(nodeUuid));
	},
	getNodeStructures: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getNodeStructures(fetch, cookies, String(slotConfigUuid));
	},
	getComponentTypes: async ({ fetch, cookies }) => {
		return getComponentTypes(fetch, cookies);
	},
	createNodeStructure: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeUuid = formData.get('nodeUuid');
			const slotConfigUuid = formData.get('slotConfigUuid');
			const componentTypeId = formData.get('componentTypeId');
			const slotStart = formData.get('slotStart');
			const slotEnd = formData.get('slotEnd');
			const purpose = formData.get('purpose') || 'component';
			const label = formData.get('label');

			if (!nodeUuid || !slotConfigUuid || !slotStart || !slotEnd) {
				return fail(400, {
					error: 'Missing required fields: nodeUuid, slotConfigUuid, slotStart, slotEnd'
				});
			}

			const headers = getAuthHeaders(cookies);
			/** @type {Record<string, any>} */
			const requestBody = {
				uuid_node_id: nodeUuid,
				slot_configuration_id: slotConfigUuid,
				slot_start: parseInt(String(slotStart)),
				slot_end: parseInt(String(slotEnd)),
				purpose
			};

			if (componentTypeId) requestBody.component_type_id = parseInt(String(componentTypeId));
			if (label) requestBody.label = label;

			const response = await fetch(`${API_URL}node-structure/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error('Error creating node structure:', response.status, errorData);
				let errorMessage = 'Failed to create structure';
				if (errorData.detail) {
					errorMessage = errorData.detail;
				} else if (errorData.error) {
					errorMessage = errorData.error;
				} else if (typeof errorData === 'object') {
					const fieldErrors = Object.entries(errorData)
						.map(
							([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
						)
						.join('; ');
					if (fieldErrors) errorMessage = fieldErrors;
				}
				return fail(response.status, { error: errorMessage });
			}

			const structure = await response.json();
			return { success: true, structure };
		} catch (err) {
			console.error('Error creating node structure:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	bulkCreateNodeStructures: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeUuid = formData.get('nodeUuid');
			const slotConfigUuid = formData.get('slotConfigUuid');
			const componentTypeId = formData.get('componentTypeId');
			const slotStart = formData.get('slotStart');
			const count = formData.get('count');
			const occupiedSlotsPerComponent = formData.get('occupiedSlotsPerComponent');

			if (
				!nodeUuid ||
				!slotConfigUuid ||
				!componentTypeId ||
				!slotStart ||
				!count ||
				!occupiedSlotsPerComponent
			) {
				return fail(400, {
					error: 'Missing required fields'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-structure/bulk-create/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					node_uuid: nodeUuid,
					slot_configuration_uuid: slotConfigUuid,
					component_type_id: parseInt(String(componentTypeId)),
					slot_start: parseInt(String(slotStart)),
					count: parseInt(String(count)),
					occupied_slots_per_component: parseInt(String(occupiedSlotsPerComponent))
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, { error: errorData.error || 'Failed to create structures' });
			}

			const result = await response.json();
			return { success: true, created: result.created, failed: result.failed };
		} catch (err) {
			console.error('Error bulk creating node structures:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	moveNodeStructure: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const structureUuid = formData.get('structureUuid');
			const slotStart = formData.get('slotStart');

			if (!structureUuid || !slotStart) {
				return fail(400, { error: 'Missing required parameters: structureUuid, slotStart' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-structure/${structureUuid}/move/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ slot_start: parseInt(String(slotStart)) })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to move structure'
				});
			}

			const structure = await response.json();
			return { success: true, structure };
		} catch (err) {
			console.error('Error moving node structure:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	deleteNodeStructure: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const structureUuid = formData.get('structureUuid');

			if (!structureUuid) {
				return fail(400, { error: 'Missing required parameter: structureUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-structure/${structureUuid}/`, {
				method: 'DELETE',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to delete structure'
				});
			}

			return { success: true };
		} catch (err) {
			console.error('Error deleting node structure:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getSlotDividers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getSlotDividers(fetch, cookies, String(slotConfigUuid));
	},
	createSlotDivider: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const slotConfigUuid = formData.get('slotConfigUuid');
			const afterSlot = formData.get('afterSlot');

			if (!slotConfigUuid || !afterSlot) {
				return fail(400, {
					error: 'Missing required fields: slotConfigUuid, afterSlot'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-slot-divider/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					slot_configuration_id: slotConfigUuid,
					after_slot: parseInt(String(afterSlot))
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.after_slot?.[0] || 'Failed to create divider'
				});
			}

			const divider = await response.json();
			return { success: true, divider };
		} catch (err) {
			console.error('Error creating slot divider:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	deleteSlotDivider: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const dividerUuid = formData.get('dividerUuid');

			if (!dividerUuid) {
				return fail(400, { error: 'Missing required parameter: dividerUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-slot-divider/${dividerUuid}/`, {
				method: 'DELETE',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to delete divider'
				});
			}

			return { success: true };
		} catch (err) {
			console.error('Error deleting slot divider:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getSlotClipNumbers: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const slotConfigUuid = formData.get('slotConfigUuid');
		return getSlotClipNumbers(fetch, cookies, String(slotConfigUuid));
	},
	upsertSlotClipNumber: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const slotConfigUuid = formData.get('slotConfigUuid');
			const slotNumber = formData.get('slotNumber');
			const clipNumber = formData.get('clipNumber');

			if (!slotConfigUuid || !slotNumber || !clipNumber) {
				return fail(400, {
					error: 'Missing required fields: slotConfigUuid, slotNumber, clipNumber'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}node-slot-clip-number/upsert/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					slot_configuration_id: slotConfigUuid,
					slot_number: parseInt(String(slotNumber)),
					clip_number: clipNumber
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to update clip number'
				});
			}

			const clipNumberData = await response.json();
			return { success: true, clipNumber: clipNumberData };
		} catch (err) {
			console.error('Error upserting slot clip number:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getCablesAtNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getCablesAtNode(fetch, cookies, String(nodeUuid));
	},
	getFibersForCable: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const cableUuid = formData.get('cableUuid');
		return getFibersForCable(fetch, cookies, String(cableUuid));
	},
	getFiberColors: async ({ fetch, cookies }) => {
		return getFiberColors(fetch, cookies);
	},
	getComponentPorts: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const componentTypeId = formData.get('componentTypeId');
		return getComponentPorts(fetch, cookies, String(componentTypeId));
	},
	getFiberSplices: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeStructureUuid = formData.get('nodeStructureUuid');
		return getFiberSplices(fetch, cookies, String(nodeStructureUuid));
	},
	upsertFiberSplice: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeStructureUuid = formData.get('nodeStructureUuid');
			const portNumber = formData.get('portNumber');
			const side = formData.get('side');
			const fiberUuid = formData.get('fiberUuid');
			const cableUuid = formData.get('cableUuid');
			const residentialUnitUuid = formData.get('residentialUnitUuid');

			if (!nodeStructureUuid || !portNumber || !side) {
				return fail(400, {
					error: 'Missing required fields: nodeStructureUuid, portNumber, side'
				});
			}

			const hasFiber = fiberUuid && cableUuid;
			const hasResidentialUnit = residentialUnitUuid;
			if (!hasFiber && !hasResidentialUnit) {
				return fail(400, {
					error: 'Either fiberUuid/cableUuid or residentialUnitUuid is required'
				});
			}

			const headers = getAuthHeaders(cookies);
			/** @type {Record<string, any>} */
			const requestBody = {
				node_structure: nodeStructureUuid,
				port_number: parseInt(String(portNumber)),
				side: side
			};

			if (hasFiber) {
				requestBody.fiber_uuid = fiberUuid;
				requestBody.cable_uuid = cableUuid;
			} else {
				requestBody.residential_unit_uuid = residentialUnitUuid;
			}

			const response = await fetch(`${API_URL}fiber-splice/upsert/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to save fiber splice'
				});
			}

			const splice = await response.json();
			return { success: true, splice };
		} catch (err) {
			console.error('Error upserting fiber splice:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	bulkUpsertFiberSplices: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const splicesJson = formData.get('splices');

			if (!splicesJson) {
				return fail(400, { error: 'Missing splices data' });
			}

			const splices = JSON.parse(String(splicesJson));

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber-splice/bulk-upsert/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ splices })
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to create splices'
				});
			}

			const result = await response.json();
			return { success: true, created: result.created, failed: result.failed };
		} catch (err) {
			console.error('Error bulk upserting fiber splices:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	clearFiberSplice: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeStructureUuid = formData.get('nodeStructureUuid');
			const portNumber = formData.get('portNumber');
			const side = formData.get('side');

			if (!nodeStructureUuid || !portNumber || !side) {
				return fail(400, {
					error: 'Missing required fields: nodeStructureUuid, portNumber, side'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber-splice/clear-port/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					node_structure: nodeStructureUuid,
					port_number: parseInt(String(portNumber)),
					side: side
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to clear fiber splice'
				});
			}

			const result = await response.json();
			return { success: true, deleted: result.deleted };
		} catch (err) {
			console.error('Error clearing fiber splice:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	mergePorts: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeStructureUuid = formData.get('nodeStructureUuid');
			const portNumbers = JSON.parse(String(formData.get('portNumbers') || '[]'));
			const side = formData.get('side') || 'both';

			if (!nodeStructureUuid || portNumbers.length < 2) {
				return fail(400, {
					error: 'Missing required fields: nodeStructureUuid and at least 2 port numbers'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber-splice/merge-ports/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					node_structure: nodeStructureUuid,
					port_numbers: portNumbers,
					side: side
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to merge ports'
				});
			}

			const result = await response.json();
			return { success: true, ...result };
		} catch (err) {
			console.error('Error merging ports:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	unmergePorts: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const mergeGroup = formData.get('mergeGroup');
			const portNumbers = JSON.parse(String(formData.get('portNumbers') || '[]'));

			if (!mergeGroup || portNumbers.length < 1) {
				return fail(400, {
					error: 'Missing required fields: mergeGroup and at least 1 port number'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber-splice/unmerge-ports/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					merge_group: mergeGroup,
					port_numbers: portNumbers
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to unmerge ports'
				});
			}

			const result = await response.json();
			return { success: true, ...result };
		} catch (err) {
			console.error('Error unmerging ports:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	upsertMergedSplice: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const mergeGroup = formData.get('mergeGroup');
			const side = formData.get('side');
			const fibers = JSON.parse(String(formData.get('fibers') || '[]'));

			if (!mergeGroup || !side || fibers.length === 0) {
				return fail(400, {
					error: 'Missing required fields: mergeGroup, side, and fibers'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber-splice/upsert-merged/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					merge_group: mergeGroup,
					side: side,
					fibers: fibers
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to connect fibers to merged ports'
				});
			}

			const result = await response.json();
			return { success: true, ...result };
		} catch (err) {
			console.error('Error upserting merged splice:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	updateCableConnection: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const cableId = formData.get('uuid');
		const uuid_node_start_id = formData.get('uuid_node_start_id');
		const uuid_node_end_id = formData.get('uuid_node_end_id');
		const handle_start = formData.get('handle_start');
		const handle_end = formData.get('handle_end');

		if (!cableId) {
			return fail(400, { message: 'Cable ID is required' });
		}

		try {
			/** @type {Record<string, any>} */
			const requestBody = {};
			if (uuid_node_start_id) requestBody.uuid_node_start_id = uuid_node_start_id;
			if (uuid_node_end_id) requestBody.uuid_node_end_id = uuid_node_end_id;
			if (handle_start) requestBody.handle_start = handle_start;
			if (handle_end) requestBody.handle_end = handle_end;

			const response = await fetch(`${API_URL}cable/${cableId}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to update cable connection'
				});
			}

			const updatedCable = await response.json();
			return { success: true, cable: updatedCable };
		} catch (err) {
			console.error('Error updating cable connection:', err);
			return fail(500, {
				message: /** @type {Error} */ (err).message || 'Failed to update cable connection'
			});
		}
	},
	getCableSplicesAtNode: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const cableUuid = formData.get('cableUuid');
		const nodeUuid = formData.get('nodeUuid');

		if (!cableUuid || !nodeUuid) {
			return fail(400, { error: 'Cable UUID and Node UUID are required' });
		}

		try {
			// Queries both cable_a and cable_b because a cable can appear on either side of a splice
			const splicesAResponse = await fetch(
				`${API_URL}fiber-splice/?cable_a=${cableUuid}&node_structure__uuid_node=${nodeUuid}`,
				{
					method: 'GET',
					headers
				}
			);

			const splicesBResponse = await fetch(
				`${API_URL}fiber-splice/?cable_b=${cableUuid}&node_structure__uuid_node=${nodeUuid}`,
				{
					method: 'GET',
					headers
				}
			);

			let splicesA = [];
			let splicesB = [];
			if (splicesAResponse.ok) {
				splicesA = await splicesAResponse.json();
			}
			if (splicesBResponse.ok) {
				splicesB = await splicesBResponse.json();
			}

			const spliceMap = new Map();
			[...splicesA, ...splicesB].forEach((splice) => {
				if (splice.uuid) {
					spliceMap.set(splice.uuid, splice);
				}
			});
			const splices = Array.from(spliceMap.values());

			return {
				splices: splices || [],
				connectedFiberCount: splices.length
			};
		} catch (err) {
			console.error('Error fetching cable splices at node:', err);
			return fail(500, { error: 'Failed to fetch cable splices' });
		}
	},
	deleteCableSplicesAtNode: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const cableUuid = formData.get('cableUuid');
		const nodeUuid = formData.get('nodeUuid');

		if (!cableUuid || !nodeUuid) {
			return fail(400, { error: 'Cable UUID and Node UUID are required' });
		}

		try {
			const splicesAResponse = await fetch(
				`${API_URL}fiber-splice/?cable_a=${cableUuid}&node_structure__uuid_node=${nodeUuid}`,
				{
					method: 'GET',
					headers
				}
			);

			const splicesBResponse = await fetch(
				`${API_URL}fiber-splice/?cable_b=${cableUuid}&node_structure__uuid_node=${nodeUuid}`,
				{
					method: 'GET',
					headers
				}
			);

			let splicesA = [];
			let splicesB = [];
			if (splicesAResponse.ok) {
				splicesA = await splicesAResponse.json();
			}
			if (splicesBResponse.ok) {
				splicesB = await splicesBResponse.json();
			}

			const spliceMap = new Map();
			[...splicesA, ...splicesB].forEach((splice) => {
				if (splice.uuid) {
					spliceMap.set(splice.uuid, splice);
				}
			});
			const splicesToDelete = Array.from(spliceMap.values());

			const deleteResults = await Promise.all(
				splicesToDelete.map(async (splice) => {
					const deleteResponse = await fetch(`${API_URL}fiber-splice/${splice.uuid}/`, {
						method: 'DELETE',
						headers
					});
					return { uuid: splice.uuid, success: deleteResponse.ok };
				})
			);

			const failedDeletes = deleteResults.filter((r) => !r.success);
			if (failedDeletes.length > 0) {
				console.warn('Some splices failed to delete:', failedDeletes);
			}

			return {
				success: true,
				deletedCount: deleteResults.filter((r) => r.success).length,
				failedCount: failedDeletes.length
			};
		} catch (err) {
			console.error('Error deleting cable splices at node:', err);
			return fail(500, { error: 'Failed to delete cable splices' });
		}
	},
	getFiberUsageInNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getFiberUsageInNode(fetch, cookies, String(nodeUuid));
	},
	getTrenchesForCable: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableId = formData.get('cableId');

		if (!cableId) {
			return fail(400, { error: 'Cable ID is required' });
		}

		try {
			const cableResponse = await fetch(`${API_URL}cable/${cableId}/`, {
				method: 'GET',
				headers
			});

			if (!cableResponse.ok) {
				return fail(cableResponse.status, { error: 'Failed to fetch cable' });
			}

			const cable = await cableResponse.json();
			const nodeIds = [cable.uuid_node_start, cable.uuid_node_end].filter(Boolean);

			if (nodeIds.length === 0) {
				return { trenches: [] };
			}

			/** @type {any[]} */
			const allTrenches = [];
			for (const nodeId of nodeIds) {
				const selectionsResponse = await fetch(
					`${API_URL}node-trench-selection/by-node/${nodeId}/`,
					{
						method: 'GET',
						headers
					}
				);

				if (selectionsResponse.ok) {
					const selections = await selectionsResponse.json();
					for (const selection of selections) {
						if (selection.trench && !allTrenches.find((t) => t.uuid === selection.trench.uuid)) {
							allTrenches.push(selection.trench);
						}
					}
				}
			}

			return { trenches: allTrenches };
		} catch (err) {
			console.error('Error fetching trenches for cable:', err);
			return fail(500, { error: 'Failed to fetch trenches' });
		}
	},
	getConduitsByTrenches: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const trenchIds = formData.get('trenchIds');
		const cableId = formData.get('cableId');

		if (!trenchIds) {
			return { conduits: [] };
		}

		try {
			let url = `${API_URL}conduits/by-trenches/?trench_ids=${encodeURIComponent(String(trenchIds))}`;
			if (cableId) {
				url += `&cable_id=${encodeURIComponent(String(cableId))}`;
			}

			const response = await fetch(url, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch conduits'
				});
			}

			const conduits = await response.json();
			return { conduits };
		} catch (err) {
			console.error('Error fetching conduits by trenches:', err);
			return fail(500, { error: 'Failed to fetch conduits' });
		}
	},
	getMicropipesByConduits: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const conduitIds = formData.get('conduitIds');
		const cableId = formData.get('cableId');

		if (!conduitIds) {
			return { micropipes: [] };
		}

		try {
			let url = `${API_URL}micropipes/by-conduits/?conduit_ids=${encodeURIComponent(String(conduitIds))}`;
			if (cableId) {
				url += `&cable_id=${encodeURIComponent(String(cableId))}`;
			}

			const response = await fetch(url, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch micropipes'
				});
			}

			const micropipes = await response.json();
			return { micropipes };
		} catch (err) {
			console.error('Error fetching micropipes by conduits:', err);
			return fail(500, { error: 'Failed to fetch micropipes' });
		}
	},
	createMicropipeConnections: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableId = formData.get('cableId');
		const micropipeNumber = formData.get('micropipeNumber');
		const color = formData.get('color');
		const conduitIdsJson = formData.get('conduitIds');

		if (!cableId || !micropipeNumber || !color || !conduitIdsJson) {
			return fail(400, {
				error: 'Missing required fields: cableId, micropipeNumber, color, conduitIds'
			});
		}

		try {
			const conduitIds = JSON.parse(String(conduitIdsJson));

			const response = await fetch(`${API_URL}cables/${cableId}/micropipe-connections/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					micropipe_number: parseInt(String(micropipeNumber)),
					color: color,
					conduit_ids: conduitIds
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to create connections'
				});
			}

			const result = await response.json();
			return { success: true, ...result };
		} catch (err) {
			console.error('Error creating micropipe connections:', err);
			return fail(500, { error: 'Failed to create connections' });
		}
	},
	deleteMicropipeConnections: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableId = formData.get('cableId');
		const micropipeNumber = formData.get('micropipeNumber');
		const conduitIdsJson = formData.get('conduitIds');

		if (!cableId || !micropipeNumber || !conduitIdsJson) {
			return fail(400, {
				error: 'Missing required fields: cableId, micropipeNumber, conduitIds'
			});
		}

		try {
			const conduitIds = JSON.parse(String(conduitIdsJson));

			const response = await fetch(`${API_URL}cables/${cableId}/micropipe-connections/`, {
				method: 'DELETE',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					micropipe_number: parseInt(String(micropipeNumber)),
					conduit_ids: conduitIds
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || errorData.error || 'Failed to delete connections'
				});
			}

			const result = await response.json();
			return { success: true, ...result };
		} catch (err) {
			console.error('Error deleting micropipe connections:', err);
			return fail(500, { error: 'Failed to delete connections' });
		}
	},
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = formData.get('layerType');
		const projectId = formData.get('projectId');

		return getLayerExtent(
			fetch,
			cookies,
			/** @type {"node" | "trench" | "address"} */ (String(layerType)),
			String(projectId)
		);
	},
	searchFeatures: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const searchQuery = data.get('searchQuery');
		const projectId = data.get('projectId');

		return searchFeaturesInProject(fetch, cookies, String(searchQuery), String(projectId));
	},
	getFeatureDetails: async ({ request, fetch, cookies }) => {
		const data = await request.formData();
		const featureType = data.get('featureType');
		const featureUuid = data.get('featureUuid');
		const projectId = data.get('projectId');

		return getFeatureDetailsByType(
			fetch,
			cookies,
			/** @type {"node" | "trench" | "address" | "area"} */ (String(featureType)),
			String(featureUuid),
			String(projectId)
		);
	},
	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid');

		return getTrenchUuidsForConduit(fetch, cookies, String(conduitUuid));
	},
	getLinkedTrenchesForCable: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableId = formData.get('cableId');

		if (!cableId) {
			return fail(400, { error: 'Cable ID is required' });
		}

		try {
			const response = await fetch(`${API_URL}cables/${cableId}/linked-trenches/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch linked trenches'
				});
			}

			const data = await response.json();
			return { trench_uuids: data.trench_uuids || [] };
		} catch (err) {
			console.error('Error fetching linked trenches for cable:', err);
			return fail(500, { error: 'Failed to fetch linked trenches' });
		}
	},
	getConduitsForCable: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableId = formData.get('cableId');

		if (!cableId) {
			return fail(400, { error: 'Cable ID is required' });
		}

		try {
			const response = await fetch(`${API_URL}cables/${cableId}/conduits/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch conduits'
				});
			}

			const data = await response.json();
			return { conduit_names: data.conduit_names || [] };
		} catch (err) {
			console.error('Error fetching conduits for cable:', err);
			return fail(500, { error: 'Failed to fetch conduits' });
		}
	},
	getMicropipeConnectionsForCable: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableId = formData.get('uuid');

		if (!cableId) {
			return fail(400, { error: 'Cable ID is required' });
		}

		try {
			const response = await fetch(
				`${API_URL}microduct_cable_connection/all/?uuid_cable=${cableId}`,
				{
					method: 'GET',
					headers
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch micropipe connections'
				});
			}

			const connections = await response.json();

			const transformed = connections.map((/** @type {any} */ conn) => ({
				number: conn.uuid_microduct?.number,
				color_hex: conn.uuid_microduct?.hex_code || '#64748b',
				color_name: conn.uuid_microduct?.color
			}));

			return { connections: transformed };
		} catch (err) {
			console.error('Error fetching micropipe connections for cable:', err);
			return fail(500, { error: 'Failed to fetch micropipe connections' });
		}
	},
	recalculateCableLength: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const cableId = formData.get('uuid');

		if (!cableId) {
			return fail(400, { error: 'Cable ID is required' });
		}

		try {
			const response = await fetch(`${API_URL}cable/${cableId}/recalculate-length/`, {
				method: 'POST',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to recalculate cable length'
				});
			}

			const data = await response.json();
			return { length: data.length, length_total: data.length_total };
		} catch (err) {
			console.error('Error recalculating cable length:', err);
			return fail(500, { error: 'Failed to recalculate cable length' });
		}
	},
	getAddressesForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getAddressesForNode(fetch, cookies, String(nodeUuid));
	},

	getUsedResidentialUnits: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getUsedResidentialUnits(fetch, cookies, String(nodeUuid));
	},

	getFiberStatusOptions: async ({ fetch, cookies }) => {
		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}attributes_fiber_status/`, {
				credentials: 'include',
				headers
			});
			if (!response.ok) {
				return fail(response.status, { error: 'Failed to fetch fiber status options' });
			}
			const data = await response.json();
			return data;
		} catch (err) {
			console.error('Error fetching fiber status options:', err);
			return fail(500, { error: 'Failed to fetch fiber status options' });
		}
	},

	updateFiberStatus: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const uuid = formData.get('uuid');
		const statusId = formData.get('fiber_status_id');

		if (!uuid) {
			return fail(400, { error: 'Missing fiber UUID' });
		}

		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber/${uuid}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					fiber_status_id: !statusId || statusId === 'null' ? null : parseInt(String(statusId), 10)
				})
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to update fiber status' });
			}

			const data = await response.json();
			return data;
		} catch (err) {
			console.error('Error updating fiber status:', err);
			return fail(500, { error: 'Failed to update fiber status' });
		}
	},

	exportExcel: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return exportNodeExcel(fetch, cookies, String(nodeUuid));
	}
};
