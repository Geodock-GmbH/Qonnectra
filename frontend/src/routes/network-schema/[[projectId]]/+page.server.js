import { API_URL } from '$env/static/private';
import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { error, fail } from '@sveltejs/kit';

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
					console.log(`Sync progress: ${currentStatus.sync_progress.toFixed(1)}% complete`);
				} else {
					console.log(`Sync completed with status: ${currentStatus.sync_status}`);
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
				console.log(
					`Canvas sync already in progress (${syncStatus.sync_progress.toFixed(1)}% complete)`
				);
				syncStatus = await _waitForSyncCompletion(fetch, headers, syncStatus, projectId);
			} else if (syncStatus.sync_needed) {
				console.log(`Syncing canvas coordinates for ${syncStatus.nodes_missing_canvas} nodes...`);

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
					console.log('Sync started by another user:', conflictData.sync_started_by);
				} else if (!syncResponse.ok) {
					console.error('Failed to sync canvas coordinates');
				} else {
					const syncResult = await syncResponse.json();
					console.log(
						`Successfully synced canvas coordinates for ${syncResult.updated_count} nodes`
					);
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
		console.log('cablesData', cablesData);
		return {
			nodes: nodesData,
			cables: cablesData,
			cableTypes: cableTypesData,
			nodeTypes: nodeTypesData,
			statuses: statusData,
			networkLevels: networkLevelData,
			companies: companyData,
			flags: flagsData,
			syncStatus: syncStatus || null
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
			syncStatus: null
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
	updateCableLabel: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const labelId = formData.get('labelId');
		const cableId = formData.get('cableId');
		const text = formData.get('text');
		const position_x = formData.get('position_x');
		const position_y = formData.get('position_y');
		const order = formData.get('order');

		// Validate required fields
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
				// Update existing label
				response = await fetch(`${API_URL}cable_label/${labelId}/`, {
					method: 'PATCH',
					credentials: 'include',
					headers: {
						...headers,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						position_x: parseFloat(position_x),
						position_y: parseFloat(position_y)
					})
				});
			} else {
				// Create new label
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

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.detail || `HTTP ${response.status}: Failed to update cable label`
				);
			}

			const updatedLabel = await response.json();

			return {
				type: 'success',
				message: labelId ? 'Label position updated successfully' : 'Label created successfully',
				label: updatedLabel
			};
		} catch (err) {
			console.error('Error saving cable label:', err);
			return {
				type: 'error',
				message: err.message || 'Failed to save cable label'
			};
		}
	}
};
