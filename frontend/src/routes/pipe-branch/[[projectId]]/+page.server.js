import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, params, cookies }) {
	const projectId = cookies.get('selected-project');

	if (!projectId) {
		return { nodes: [] };
	}

	try {
		const response = await fetch(`${API_URL}node/all/?project=${projectId}&group=RAB`, {
			credentials: 'include',
			headers: getAuthHeaders(cookies)
		});

		if (!response.ok) {
			console.error(`Failed to fetch nodes: ${response.status}`);
			return { nodes: [] };
		}

		const data = await response.json();

		if (
			typeof data === 'object' &&
			data !== null &&
			data.type === 'FeatureCollection' &&
			Array.isArray(data.features)
		) {
			const nodes = data.features.map((feature) => ({
				label: feature.properties.name,
				value: feature.properties.name
			}));
			return { nodes };
		} else {
			console.error('Invalid GeoJSON FeatureCollection structure:', data);
			return { nodes: [] };
		}
	} catch (error) {
		console.error('Error fetching data:', error);
		return { nodes: [] };
	}
}

/** @type {import('./$types').Actions} */
export const actions = {
	getConnections: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeId = formData.get('node_id');

			if (!nodeId) {
				return fail(400, {
					error: 'Missing required parameter: node_id is required'
				});
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}microduct_connection/all_connections/?uuid_node=${encodeURIComponent(nodeId)}`;

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

			const connections = await response.json();
			return { type: 'success', data: connections };
		} catch (error) {
			console.error('Microduct connections GET action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},

	createConnection: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const uuid_microduct_from = formData.get('uuid_microduct_from');
			const uuid_microduct_to = formData.get('uuid_microduct_to');
			const uuid_node = formData.get('uuid_node');
			const uuid_trench_from = formData.get('uuid_trench_from');
			const uuid_trench_to = formData.get('uuid_trench_to');

			if (
				!uuid_microduct_from ||
				!uuid_microduct_to ||
				!uuid_node ||
				!uuid_trench_from ||
				!uuid_trench_to
			) {
				return fail(400, {
					error:
						'Missing required fields: uuid_microduct_from, uuid_microduct_to, uuid_node, uuid_trench_from, and uuid_trench_to are required'
				});
			}

			// Validate that we're not connecting a microduct to itself
			if (uuid_microduct_from === uuid_microduct_to) {
				return fail(400, {
					error: 'Cannot connect a microduct to itself'
				});
			}

			const headers = new Headers({
				'Content-Type': 'application/json'
			});

			const accessToken = cookies.get('api-access-token');
			if (accessToken) {
				headers.append('Cookie', `api-access-token=${accessToken}`);
			}

			const backendUrl = `${API_URL}microduct_connection/`;

			console.log('Sending to Django backend:', {
				url: backendUrl,
				body: {
					uuid_microduct_from,
					uuid_microduct_to,
					uuid_node,
					uuid_trench_from,
					uuid_trench_to
				}
			});

			const response = await fetch(backendUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					uuid_microduct_from_id: uuid_microduct_from,
					uuid_microduct_to_id: uuid_microduct_to,
					uuid_node_id: uuid_node,
					uuid_trench_from_id: uuid_trench_from,
					uuid_trench_to_id: uuid_trench_to
				})
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

			const connection = await response.json();
			return { type: 'success', data: connection };
		} catch (error) {
			console.error('Microduct connections POST action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},

	deleteConnection: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const connectionUuid = formData.get('uuid');

			if (!connectionUuid) {
				return fail(400, {
					error: 'Missing required parameter: uuid is required'
				});
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}microduct_connection/${encodeURIComponent(connectionUuid)}/`;

			const response = await fetch(backendUrl, {
				method: 'DELETE',
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

			return { type: 'success', data: { success: true } };
		} catch (error) {
			console.error('Microduct connections DELETE action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	},

	getTrenchesNearNode: async ({ request, cookies }) => {
		try {
			const formData = await request.formData();
			const nodeName = formData.get('node_name');
			const project = formData.get('project');

			if (!nodeName || !project) {
				return fail(400, {
					error: 'Missing required parameters: node_name and project are required'
				});
			}

			const headers = getAuthHeaders(cookies);
			const backendUrl = `${API_URL}trenches-near-node/?node_name=${encodeURIComponent(nodeName)}&project=${encodeURIComponent(project)}`;

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

			const trenches = await response.json();
			return { type: 'success', data: trenches };
		} catch (error) {
			console.error('Trench near nodes action error:', error);
			return fail(500, { error: 'Internal server error' });
		}
	}
};
