import { API_URL } from '$env/static/private';
import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { error } from '@sveltejs/kit';

/**
 * Poll for sync completion with timeout and progress updates
 * @param {Function} fetch - SvelteKit fetch function
 * @param {Headers} headers - Auth headers
 * @param {Object} initialStatus - Initial sync status
 * @returns {Promise<Object>} Final sync status
 */
export async function _waitForSyncCompletion(fetch, headers, initialStatus, maxWaitTimeMs = 30000) {
	const startTime = Date.now();
	const pollInterval = 2000;
	let currentStatus = initialStatus;

	console.log('Waiting for canvas sync to complete...');

	while (currentStatus.sync_in_progress && Date.now() - startTime < maxWaitTimeMs) {
		await new Promise((resolve) => setTimeout(resolve, pollInterval));

		try {
			const response = await fetch(`${API_URL}canvas-coordinates/?project_id=1`, {
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
export async function load({ fetch, cookies }) {
	const headers = getAuthHeaders(cookies);

	try {
		let syncStatus = null;

		const syncStatusResponse = await fetch(`${API_URL}canvas-coordinates/?project_id=1`, {
			credentials: 'include',
			headers: headers
		});

		if (!syncStatusResponse.ok) {
			console.warn('Failed to check canvas sync status');
		} else {
			syncStatus = await syncStatusResponse.json();

			if (syncStatus.sync_in_progress) {
				console.log(
					`Canvas sync already in progress (${syncStatus.sync_progress.toFixed(1)}% complete)`
				);
				syncStatus = await _waitForSyncCompletion(fetch, headers, syncStatus);
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
						project_id: 1,
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

		const nodeResponse = await fetch(`${API_URL}node/all/?project=1`, {
			credentials: 'include',
			headers: headers
		});

		if (!nodeResponse.ok) {
			throw error(500, 'Failed to fetch nodes');
		}

		const nodesData = await nodeResponse.json();

		return {
			nodes: nodesData,
			syncStatus: syncStatus || null
		};
	} catch (err) {
		if (err.status === 500 && err.message === 'Failed to fetch nodes') {
			throw err;
		}

		console.error('Error loading cable page:', err);
		return {
			nodes: [],
			syncStatus: null
		};
	}
}
