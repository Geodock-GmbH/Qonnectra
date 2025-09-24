import { API_URL } from '$env/static/private';
import { error } from '@sveltejs/kit';

function getAuthHeaders(cookies) {
	const accessToken = cookies.get('api-access-token');
	const headers = new Headers();
	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}
	return headers;
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies }) {
	const headers = getAuthHeaders(cookies);

	try {
		const syncStatusResponse = await fetch(`${API_URL}canvas-coordinates/?project_id=1`, {
			credentials: 'include',
			headers: headers
		});

		if (!syncStatusResponse.ok) {
			console.warn('Failed to check canvas sync status');
		} else {
			const syncStatus = await syncStatusResponse.json();

			if (syncStatus.sync_needed) {
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

				if (!syncResponse.ok) {
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
			nodes: nodesData
		};
	} catch (err) {
		console.error('Error loading cable page:', err);
		return {
			nodes: []
		};
	}
}
