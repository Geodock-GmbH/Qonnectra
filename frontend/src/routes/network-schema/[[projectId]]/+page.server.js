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

		const [nodeResponse, cableResponse, cableTypeResponse] = await Promise.all([
			fetch(`${API_URL}node/all/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}cable/all/?project=${projectId}`, {
				credentials: 'include',
				headers: headers
			}),
			fetch(`${API_URL}attributes_cable_type/`, {
				credentials: 'include',
				headers: headers
			})
		]);

		if (!nodeResponse.ok) {
			throw error(500, 'Failed to fetch nodes');
		}

		const nodesData = await nodeResponse.json();

		let cablesData = [];
		let cableTypesData = [];
		if (cableResponse.ok) {
			cablesData = await cableResponse.json();
		} else {
			console.warn('Failed to fetch cables, continuing without them');
		}

		if (cableTypeResponse.ok) {
			cableTypesData = await cableTypeResponse.json();
			cableTypesData = cableTypesData.map((item) => ({
				value: item.id,
				label: item.cable_type
			}));
		} else {
			console.warn('Failed to fetch cable types, continuing without them');
		}

		return {
			nodes: nodesData,
			cables: cablesData,
			cableTypes: cableTypesData,
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
			syncStatus: null
		};
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
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

	getCables: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const projectId = formData.get('project');

			if (!projectId) {
				return fail(400, {
					error: 'Missing required parameter: project is required'
				});
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}cable/all/?project=${encodeURIComponent(projectId)}`;

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
			console.log('Cables:', cables);
			return { type: 'success', data: cables };
		} catch (error) {
			console.error('Cable GET action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},

	createCable: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
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

			// Add optional handle fields
			if (handle_start) {
				requestBody.handle_start = handle_start;
			}
			if (handle_end) {
				requestBody.handle_end = handle_end;
			}

			console.log('Creating cable:', requestBody);

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
	}
};
