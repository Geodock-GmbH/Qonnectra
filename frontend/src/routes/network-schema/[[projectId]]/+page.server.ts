import type { Actions, PageServerLoad } from './$types';
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
	getFiberSplices,
	getSlotClipNumbers,
	getSlotConfigurationsForNode,
	getSlotDividers,
	mapNodesToOptions
} from '$lib/server/nodeData';

/**
 * Poll for sync completion with timeout and progress updates
 */
export async function _waitForSyncCompletion(
	fetch: typeof globalThis.fetch,
	headers: Record<string, string> | Headers,
	initialStatus: Record<string, unknown> & { sync_in_progress: boolean },
	maxWaitTimeMs: number = 30000,
	projectId: string
): Promise<Record<string, unknown> & { sync_in_progress: boolean }> {
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
 */
export const load: PageServerLoad = async ({ fetch, cookies, url, params }) => {
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

		let syncStatus: (Record<string, unknown> & { sync_in_progress: boolean }) | null = null;

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

			if (syncStatus && syncStatus.sync_in_progress) {
				syncStatus = await _waitForSyncCompletion(fetch, headers, syncStatus, 30000, projectId);
			} else if ((syncStatus as Record<string, unknown>).sync_needed) {
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

		let cablesData: Record<string, unknown>[] = [];
		let cableLabelsData: Record<string, unknown>[] = [];
		let cableMicropipeConnections: Record<string, unknown> = {};
		let cableTypesData: Record<string, unknown>[] = [];
		let nodeTypesData: Record<string, unknown>[] = [];
		let statusData: Record<string, unknown>[] = [];
		let networkLevelData: Record<string, unknown>[] = [];
		let companyData: Record<string, unknown>[] = [];
		let flagsData: Record<string, unknown>[] = [];

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

		const cableLabelMap: Record<string, unknown[]> = {};
		cableLabelsData.forEach((label: Record<string, unknown>) => {
			const cableUuid = (label.cable as Record<string, unknown>)?.uuid || label.cable;
			if (!cableLabelMap[cableUuid as string]) {
				cableLabelMap[cableUuid as string] = [];
			}
			cableLabelMap[cableUuid as string].push(label);
		});

		cablesData = cablesData.map((cable: Record<string, unknown>) => {
			const cableUuid = cable.uuid || (cable.cable as Record<string, unknown>)?.uuid || cable.cable;
			return {
				...cable,
				uuid: cableUuid,
				labelData: cableLabelMap[cableUuid as string]?.[0] || null
			};
		});

		if (cableTypeResponse.ok) {
			cableTypesData = await cableTypeResponse.json();
			cableTypesData = cableTypesData.map((item: Record<string, unknown>) => ({
				value: item.id,
				label: item.cable_type
			}));
		} else {
			console.warn('Failed to fetch cable types, continuing without them');
		}

		if (nodeTypeResponse.ok) {
			nodeTypesData = await nodeTypeResponse.json();
			nodeTypesData = nodeTypesData.map((item: Record<string, unknown>) => ({
				value: item.id,
				label: item.node_type
			}));
		} else {
			console.warn('Failed to fetch node types data, continuing without it');
		}

		if (statusResponse.ok) {
			statusData = await statusResponse.json();
			statusData = statusData.map((item: Record<string, unknown>) => ({
				value: item.id,
				label: item.status
			}));
		} else {
			console.warn('Failed to fetch status data, continuing without it');
		}

		if (networkLevelResponse.ok) {
			networkLevelData = await networkLevelResponse.json();
			networkLevelData = networkLevelData.map((item: Record<string, unknown>) => ({
				value: item.id,
				label: item.network_level
			}));
		} else {
			console.warn('Failed to fetch network level data, continuing without it');
		}

		if (companyResponse.ok) {
			companyData = await companyResponse.json();
			companyData = companyData.map((item: Record<string, unknown>) => ({
				value: item.id,
				label: item.company
			}));
		} else {
			console.warn('Failed to fetch company data, continuing without it');
		}

		if (flagsResponse.ok) {
			flagsData = await flagsResponse.json();
			flagsData = flagsData.map((item: Record<string, unknown>) => ({
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
		const typedErr = err as { status?: number; message?: string };
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
};

/**
 * SvelteKit form actions for the network schema page.
 * Handles CRUD operations for cables, nodes, slot configurations, containers,
 * node structures, fiber splices, micropipe connections, and related entities.
 */
export const actions = {
	getSlotConfigurationsForNode: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeUuid = formData.get('nodeUuid');
		return getSlotConfigurationsForNode(fetch, cookies, String(nodeUuid));
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
			const requestBody: Record<string, unknown> = {
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
	getFiberSplices: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const nodeStructureUuid = formData.get('nodeStructureUuid');
		return getFiberSplices(fetch, cookies, String(nodeStructureUuid));
	},
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = formData.get('layerType');
		const projectId = formData.get('projectId');

		return getLayerExtent(
			fetch,
			cookies,
			String(layerType) as 'node' | 'trench' | 'address',
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
			String(featureType) as 'node' | 'trench' | 'address' | 'area',
			String(featureUuid),
			String(projectId)
		);
	},
	getConduitTrenches: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const conduitUuid = formData.get('conduitUuid');

		return getTrenchUuidsForConduit(fetch, cookies, String(conduitUuid));
	}
} satisfies Actions;
