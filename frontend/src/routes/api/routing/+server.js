import { json } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

export async function POST({ request, cookies }) {
	try {
		const { startTrenchId, endTrenchId, projectId, tolerance } = await request.json();

		if (!startTrenchId || !endTrenchId || !projectId || tolerance === undefined) {
			return json(
				{
					error:
						'Missing required parameters: startTrenchId, endTrenchId, projectId, and tolerance are required'
				},
				{ status: 400 }
			);
		}

		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();
		headers.append('Content-Type', 'application/json');

		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

		const backendUrl = `${API_URL}routing/`;

		const response = await fetch(backendUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				start_trench_id: startTrenchId,
				end_trench_id: endTrenchId,
				project_id: projectId,
				tolerance
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorData;

			try {
				errorData = JSON.parse(errorText);
			} catch {
				errorData = { error: errorText || `Routing failed with status: ${response.status}` };
			}

			return json(errorData, { status: response.status });
		}

		const routeData = await response.json();
		return json(routeData);
	} catch (error) {
		console.error('Routing API error:', error);
		return json({ error: 'Internal server error during routing calculation' }, { status: 500 });
	}
}
