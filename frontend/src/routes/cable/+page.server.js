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
	try {
		const [nodeResponse] = await Promise.all([
			fetch(`${API_URL}ol_node/all/?project=1`, {
				credentials: 'include',
				headers: getAuthHeaders(cookies)
			})
		]);

		if (!nodeResponse.ok) {
			throw error(500, 'Failed to fetch nodes');
		}

		const nodesData = await nodeResponse.json();

		return {
			nodes: nodesData
		};
	} catch (err) {
		console.error('Error fetching nodes:', err);
		return {
			nodes: []
		};
	}
}
