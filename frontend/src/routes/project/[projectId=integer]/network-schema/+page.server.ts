import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { mapNodesToOptions } from '$lib/remote/network-schema/node-options';

type SyncStatus = Record<string, unknown> & { sync_in_progress: boolean };
type AuthHeaders = Record<string, string> | Headers;

/**
 * Fetches the canvas-coordinate sync status of a project.
 * Returns null when the backend answers with an error status; network errors propagate.
 */
async function fetchSyncStatus(
	fetch: typeof globalThis.fetch,
	headers: AuthHeaders,
	projectId: string
): Promise<SyncStatus | null> {
	const response = await fetch(`${API_URL}canvas-coordinates/?project_id=${projectId}`, {
		credentials: 'include',
		headers
	});
	if (!response.ok) return null;
	return response.json();
}

/**
 * Poll for sync completion with timeout and progress updates
 */
export async function _waitForSyncCompletion(
	fetch: typeof globalThis.fetch,
	headers: AuthHeaders,
	initialStatus: SyncStatus,
	maxWaitTimeMs: number = 30000,
	projectId: string
): Promise<SyncStatus> {
	const startTime = Date.now();
	const pollInterval = 2000;
	let currentStatus = initialStatus;

	while (currentStatus.sync_in_progress && Date.now() - startTime < maxWaitTimeMs) {
		await new Promise((resolve) => setTimeout(resolve, pollInterval));

		let polledStatus: SyncStatus | null;
		try {
			polledStatus = await fetchSyncStatus(fetch, headers, projectId);
		} catch (error) {
			console.error('Error polling sync status:', error);
			break;
		}

		if (!polledStatus) {
			console.warn('Failed to check sync status during polling');
			break;
		}
		currentStatus = polledStatus;
	}

	if (currentStatus.sync_in_progress && Date.now() - startTime >= maxWaitTimeMs) {
		console.warn('Sync polling timed out - proceeding with current data');
	}

	return currentStatus;
}

/**
 * Asks the backend to compute the missing canvas coordinates of a project.
 * A 409 means another sync is already running, which is fine.
 */
async function startCanvasSync(
	fetch: typeof globalThis.fetch,
	headers: AuthHeaders,
	projectId: string
): Promise<void> {
	const response = await fetch(`${API_URL}canvas-coordinates/`, {
		method: 'POST',
		credentials: 'include',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ project_id: projectId, scale: 0.5 })
	});
	if (!response.ok && response.status !== 409) {
		console.error('Failed to sync canvas coordinates');
	}
}

/**
 * Brings the project's canvas coordinates up to date before the page renders:
 * waits for a running sync, or starts one when nodes lack coordinates.
 * Returns the sync status, or null when it could not be checked.
 */
async function syncCanvasCoordinates(
	fetch: typeof globalThis.fetch,
	headers: AuthHeaders,
	projectId: string
): Promise<SyncStatus | null> {
	const status = await fetchSyncStatus(fetch, headers, projectId);
	if (!status) {
		console.warn('Failed to check canvas sync status');
		return null;
	}

	if (status.sync_in_progress) {
		return _waitForSyncCompletion(fetch, headers, status, 30000, projectId);
	}
	if (status.sync_needed) {
		await startCanvasSync(fetch, headers, projectId);
	}
	return status;
}

/**
 * Loads network schema page data including nodes, cables, attribute options, and sync status.
 * Triggers canvas coordinate sync if needed and waits for completion before returning.
 */
export const load: PageServerLoad = async ({ fetch, cookies, params }) => {
	const headers = getAuthHeaders(cookies);
	const projectId = params.projectId;

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

		const syncStatus = await syncCanvasCoordinates(fetch, headers, projectId);

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
			syncStatus,
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
