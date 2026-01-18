import { error, fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Poll for sync completion with timeout and progress updates
 * @param {Function} fetch - SvelteKit fetch function
 * @param {Headers} headers - Auth headers
 * @param {Object} initialStatus - Initial sync status
 * @returns {Promise<Object>} Final sync status
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
				if (currentStatus.sync_in_progress) {
				} else {
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

/** @type {import('./$types').PageServerLoad} */
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
			syncStatus: null
		};
	}

	try {
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
				syncStatus = await _waitForSyncCompletion(fetch, headers, syncStatus, projectId);
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
						scale: 0.2
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
			nodeResponse,
			cableResponse,
			cableLabelResponse,
			cableTypeResponse,
			nodeTypeResponse,
			statusResponse,
			networkLevelResponse,
			companyResponse,
			flagsResponse
		] = await Promise.all([
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

		if (!nodeResponse.ok) {
			throw error(500, 'Failed to fetch nodes');
		}

		const nodesData = await nodeResponse.json();
		const networkSchemaSettingsConfigured = nodesData?.metadata?.settings_configured ?? false;

		let cablesData = [];
		let cableLabelsData = [];
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

		const cableLabelMap = {};
		cableLabelsData.forEach((label) => {
			const cableUuid = label.cable?.uuid || label.cable;
			if (!cableLabelMap[cableUuid]) {
				cableLabelMap[cableUuid] = [];
			}
			cableLabelMap[cableUuid].push(label);
		});

		cablesData = cablesData.map((cable) => {
			const cableUuid = cable.uuid || (cable.cable && cable.cable.uuid) || cable.cable;
			return {
				...cable,
				uuid: cableUuid,
				labelData: cableLabelMap[cableUuid]?.[0] || null
			};
		});

		if (cableTypeResponse.ok) {
			cableTypesData = await cableTypeResponse.json();
			cableTypesData = cableTypesData.map((item) => ({
				value: item.id,
				label: item.cable_type
			}));
		} else {
			console.warn('Failed to fetch cable types, continuing without them');
		}

		if (nodeTypeResponse.ok) {
			nodeTypesData = await nodeTypeResponse.json();
			nodeTypesData = nodeTypesData.map((item) => ({
				value: item.id,
				label: item.node_type
			}));
		} else {
			console.warn('Failed to fetch node types data, continuing without it');
		}

		if (statusResponse.ok) {
			statusData = await statusResponse.json();
			statusData = statusData.map((item) => ({
				value: item.id,
				label: item.status
			}));
		} else {
			console.warn('Failed to fetch status data, continuing without it');
		}

		if (networkLevelResponse.ok) {
			networkLevelData = await networkLevelResponse.json();
			networkLevelData = networkLevelData.map((item) => ({
				value: item.id,
				label: item.network_level
			}));
		} else {
			console.warn('Failed to fetch network level data, continuing without it');
		}

		if (companyResponse.ok) {
			companyData = await companyResponse.json();
			companyData = companyData.map((item) => ({
				value: item.id,
				label: item.company
			}));
		} else {
			console.warn('Failed to fetch company data, continuing without it');
		}

		if (flagsResponse.ok) {
			flagsData = await flagsResponse.json();
			flagsData = flagsData.map((item) => ({
				value: item.id,
				label: item.flag
			}));
		} else {
			console.warn('Failed to fetch flags data, continuing without it');
		}

		return {
			nodes: nodesData,
			cables: cablesData,
			cableTypes: cableTypesData,
			nodeTypes: nodeTypesData,
			statuses: statusData,
			networkLevels: networkLevelData,
			companies: companyData,
			flags: flagsData,
			syncStatus: syncStatus || null,
			networkSchemaSettingsConfigured
		};
	} catch (err) {
		if (err.status === 500 && err.message === 'Failed to fetch nodes') {
			throw err;
		}

		console.error('Error loading network schema page:', err);
		return {
			nodes: [],
			cables: [],
			cableTypes: [],
			nodeTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: [],
			syncStatus: null,
			networkSchemaSettingsConfigured: false
		};
	}
}

/** @type {import('./$types').Actions} */
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

			// Validate required fields
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

			const requestBody = {
				name,
				cable_type_id: parseInt(cable_type_id),
				project_id: parseInt(project_id),
				flag_id: parseInt(flag_id),
				uuid_node_start_id: uuid_node_start_id,
				uuid_node_end_id: uuid_node_end_id
			};

			// Add optional UUID field
			if (uuid) {
				requestBody.uuid = uuid;
			}

			// Add optional handle fields
			if (handle_start) {
				requestBody.handle_start = handle_start;
			}
			if (handle_end) {
				requestBody.handle_end = handle_end;
			}

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
			const requestBody = {};

			if (name) requestBody.name = name;
			if (cable_type_id) requestBody.cable_type_id = parseInt(cable_type_id);
			if (status_id) requestBody.status_id = parseInt(status_id);
			if (network_level_id) requestBody.network_level_id = parseInt(network_level_id);
			if (owner_id) requestBody.owner_id = parseInt(owner_id);
			if (constructor_id) requestBody.constructor_id = parseInt(constructor_id);
			if (manufacturer_id) requestBody.manufacturer_id = parseInt(manufacturer_id);
			if (flag_id) requestBody.flag_id = parseInt(flag_id);
			if (date) requestBody.date = date;
			if (reserve_at_start) requestBody.reserve_at_start = parseInt(reserve_at_start);
			if (reserve_at_end) requestBody.reserve_at_end = parseInt(reserve_at_end);
			if (reserve_section) requestBody.reserve_section = parseInt(reserve_section);
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
			return fail(500, { message: err.message || 'Failed to update cable' });
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
			return fail(500, { message: err.message || 'Failed to delete cable' });
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
				diagram_path = JSON.parse(diagramPathJson);
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
				message: err.message || 'Failed to save cable path'
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

		if (!nodeId) {
			return {
				type: 'error',
				message: 'Node ID is required'
			};
		}

		try {
			const requestBody = {};

			if (name) requestBody.name = name;
			if (node_type_id) requestBody.node_type_id = parseInt(node_type_id);
			if (status_id) requestBody.status_id = parseInt(status_id);
			if (network_level_id) requestBody.network_level_id = parseInt(network_level_id);
			if (owner_id) requestBody.owner_id = parseInt(owner_id);
			if (constructor_id) requestBody.constructor_id = parseInt(constructor_id);
			if (manufacturer_id) requestBody.manufacturer_id = parseInt(manufacturer_id);
			if (flag_id) requestBody.flag_id = parseInt(flag_id);
			if (date) requestBody.date = date;
			if (warranty) requestBody.warranty = warranty;

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
			return fail(500, { message: err.message || 'Failed to update node' });
		}
	},
	saveNodeGeometry: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const nodeId = formData.get('nodeId');
		const canvas_x = parseFloat(formData.get('canvas_x'));
		const canvas_y = parseFloat(formData.get('canvas_y'));

		if (!nodeId) {
			return {
				type: 'error',
				message: 'Node ID is required'
			};
		}

		if (isNaN(canvas_x) || isNaN(canvas_y)) {
			return {
				type: 'error',
				message: 'Invalid canvas coordinates'
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
				body: JSON.stringify({
					canvas_x,
					canvas_y
				})
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
				message: err.message || 'Failed to save node position'
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
					total_slots: parseInt(totalSlots)
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
			const requestBody = {};
			if (side) requestBody.side = side;
			if (totalSlots) requestBody.total_slots = parseInt(totalSlots);

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
		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}container-type/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to fetch container types' });
			}

			const containerTypes = await response.json();
			return { containerTypes };
		} catch (err) {
			console.error('Error fetching container types:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getContainerHierarchy: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeUuid = formData.get('nodeUuid');

			if (!nodeUuid) {
				return fail(400, { error: 'Missing required parameter: nodeUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}container/tree/${nodeUuid}/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch hierarchy'
				});
			}

			const hierarchy = await response.json();
			return { hierarchy };
		} catch (err) {
			console.error('Error fetching container hierarchy:', err);
			return fail(500, { error: 'Internal server error' });
		}
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
			const requestBody = {
				uuid_node_id: nodeUuid,
				container_type_id: parseInt(containerTypeId)
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

			// First get current state
			const getResponse = await fetch(`${API_URL}container/${containerUuid}/`, {
				method: 'GET',
				headers
			});

			if (!getResponse.ok) {
				return fail(getResponse.status, { error: 'Container not found' });
			}

			const container = await getResponse.json();

			// Toggle the state
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
						position_x: parseFloat(position_x),
						position_y: parseFloat(position_y)
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
								position_x: parseFloat(position_x),
								position_y: parseFloat(position_y)
							})
						});
					} else {
						const requestBody = {
							cable_id: cableId,
							text: text || 'Label',
							position_x: parseFloat(position_x),
							position_y: parseFloat(position_y),
							order: order ? parseInt(order) : 0
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
						position_x: parseFloat(position_x),
						position_y: parseFloat(position_y),
						order: order ? parseInt(order) : 0
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
			return fail(500, { message: err.message || 'Failed to save cable label' });
		}
	},
	getSlotConfigurationsForNode: async ({ request, fetch, cookies }) => {
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
	getNodeStructures: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const slotConfigUuid = formData.get('slotConfigUuid');

			if (!slotConfigUuid) {
				return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(
				`${API_URL}node-structure/?slot_configuration=${slotConfigUuid}`,
				{
					method: 'GET',
					headers
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch node structures'
				});
			}

			const structures = await response.json();
			return { structures };
		} catch (err) {
			console.error('Error fetching node structures:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getComponentTypes: async ({ fetch, cookies }) => {
		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}attributes_component_type/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to fetch component types' });
			}

			const componentTypes = await response.json();
			return { componentTypes };
		} catch (err) {
			console.error('Error fetching component types:', err);
			return fail(500, { error: 'Internal server error' });
		}
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
			const requestBody = {
				uuid_node_id: nodeUuid,
				slot_configuration_id: slotConfigUuid,
				slot_start: parseInt(slotStart),
				slot_end: parseInt(slotEnd),
				purpose
			};

			if (componentTypeId) requestBody.component_type_id = parseInt(componentTypeId);
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
				// Build error message from all fields
				let errorMessage = 'Failed to create structure';
				if (errorData.detail) {
					errorMessage = errorData.detail;
				} else if (errorData.error) {
					errorMessage = errorData.error;
				} else if (typeof errorData === 'object') {
					// DRF returns field errors as object
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
				body: JSON.stringify({ slot_start: parseInt(slotStart) })
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
		try {
			const formData = await request.formData();
			const slotConfigUuid = formData.get('slotConfigUuid');

			if (!slotConfigUuid) {
				return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(
				`${API_URL}node-slot-divider/?slot_configuration=${slotConfigUuid}`,
				{
					method: 'GET',
					headers
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch dividers'
				});
			}

			const data = await response.json();
			// Handle both paginated and non-paginated responses
			const dividers = Array.isArray(data) ? data : data.results || [];
			return { dividers };
		} catch (err) {
			console.error('Error fetching slot dividers:', err);
			return fail(500, { error: 'Internal server error' });
		}
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
					after_slot: parseInt(afterSlot)
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
		try {
			const formData = await request.formData();
			const slotConfigUuid = formData.get('slotConfigUuid');

			if (!slotConfigUuid) {
				return fail(400, { error: 'Missing required parameter: slotConfigUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(
				`${API_URL}node-slot-clip-number/?slot_configuration=${slotConfigUuid}`,
				{
					method: 'GET',
					headers
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch clip numbers'
				});
			}

			const data = await response.json();
			// Handle both paginated and non-paginated responses
			const clipNumbers = Array.isArray(data) ? data : data.results || [];
			return { clipNumbers };
		} catch (err) {
			console.error('Error fetching slot clip numbers:', err);
			return fail(500, { error: 'Internal server error' });
		}
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
					slot_number: parseInt(slotNumber),
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
		try {
			const formData = await request.formData();
			const nodeUuid = formData.get('nodeUuid');

			if (!nodeUuid) {
				return fail(400, { error: 'Missing required parameter: nodeUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}cable/at-node/${nodeUuid}/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch cables at node'
				});
			}

			const cables = await response.json();
			return { cables };
		} catch (err) {
			console.error('Error fetching cables at node:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getFibersForCable: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const cableUuid = formData.get('cableUuid');

			if (!cableUuid) {
				return fail(400, { error: 'Missing required parameter: cableUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber/by-cable/${cableUuid}/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch fibers for cable'
				});
			}

			const fibers = await response.json();
			return { fibers };
		} catch (err) {
			console.error('Error fetching fibers for cable:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getFiberColors: async ({ fetch, cookies }) => {
		try {
			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}attributes_fiber_color/`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				return fail(response.status, { error: 'Failed to fetch fiber colors' });
			}

			const fiberColors = await response.json();
			return { fiberColors };
		} catch (err) {
			console.error('Error fetching fiber colors:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getComponentPorts: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const componentTypeId = formData.get('componentTypeId');

			if (!componentTypeId) {
				return fail(400, { error: 'Missing required parameter: componentTypeId' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(
				`${API_URL}attributes_component_structure/?component_type=${componentTypeId}`,
				{
					method: 'GET',
					headers
				}
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch component ports'
				});
			}

			const ports = await response.json();
			return { ports };
		} catch (err) {
			console.error('Error fetching component ports:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	getFiberSplices: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeStructureUuid = formData.get('nodeStructureUuid');

			if (!nodeStructureUuid) {
				return fail(400, { error: 'Missing required parameter: nodeStructureUuid' });
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber-splice/?node_structure=${nodeStructureUuid}`, {
				method: 'GET',
				headers
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: errorData.detail || 'Failed to fetch fiber splices'
				});
			}

			const splices = await response.json();
			return { splices };
		} catch (err) {
			console.error('Error fetching fiber splices:', err);
			return fail(500, { error: 'Internal server error' });
		}
	},
	upsertFiberSplice: async ({ request, fetch, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeStructureUuid = formData.get('nodeStructureUuid');
			const portNumber = formData.get('portNumber');
			const side = formData.get('side');
			const fiberUuid = formData.get('fiberUuid');
			const cableUuid = formData.get('cableUuid');

			if (!nodeStructureUuid || !portNumber || !side || !fiberUuid || !cableUuid) {
				return fail(400, {
					error:
						'Missing required fields: nodeStructureUuid, portNumber, side, fiberUuid, cableUuid'
				});
			}

			const headers = getAuthHeaders(cookies);
			const response = await fetch(`${API_URL}fiber-splice/upsert/`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					node_structure: nodeStructureUuid,
					port_number: parseInt(portNumber),
					side: side,
					fiber_uuid: fiberUuid,
					cable_uuid: cableUuid
				})
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
					port_number: parseInt(portNumber),
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
	}
};
