import { API_URL } from '$env/static/private';
import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
	try {
		const nodeName = url.searchParams.get('node_name');
		const project = url.searchParams.get('project');

		if (!nodeName || !project) {
			return json(
				{
					error: 'Missing required parameters: node_name and project are required'
				},
				{ status: 400 }
			);
		}

		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();

		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

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

			return json(errorData, { status: response.status });
		}

		const trenches = await response.json();
		return json(trenches);
	} catch (error) {
		console.error('Trench near nodes API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
