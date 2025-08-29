import { API_URL } from '$env/static/private';
import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, cookies }) {
	try {
		const nodeId = url.searchParams.get('node_id');

		if (!nodeId) {
			return json(
				{
					error: 'Missing required parameter: node_id is required'
				},
				{ status: 400 }
			);
		}

		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();

		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

		const backendUrl = `${API_URL}microduct_connection/?uuid_node=${encodeURIComponent(nodeId)}`;

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

		const connections = await response.json();
		return json(connections);
	} catch (error) {
		console.error('Microduct connections GET API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
	try {
		const body = await request.json();
		const { uuid_microduct_from, uuid_microduct_to, uuid_node } = body;

		if (!uuid_microduct_from || !uuid_microduct_to || !uuid_node) {
			return json(
				{
					error: 'Missing required fields: uuid_microduct_from, uuid_microduct_to, and uuid_node are required'
				},
				{ status: 400 }
			);
		}

		// Validate that we're not connecting a microduct to itself
		if (uuid_microduct_from === uuid_microduct_to) {
			return json(
				{
					error: 'Cannot connect a microduct to itself'
				},
				{ status: 400 }
			);
		}

		const accessToken = cookies.get('api-access-token');
		const headers = new Headers({
			'Content-Type': 'application/json'
		});

		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

		const backendUrl = `${API_URL}microduct_connection/`;

		const response = await fetch(backendUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				uuid_microduct_from,
				uuid_microduct_to,
				uuid_node
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

			return json(errorData, { status: response.status });
		}

		const connection = await response.json();
		return json(connection);
	} catch (error) {
		console.error('Microduct connections POST API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ url, cookies }) {
	try {
		const connectionUuid = url.searchParams.get('uuid');

		if (!connectionUuid) {
			return json(
				{
					error: 'Missing required parameter: uuid is required'
				},
				{ status: 400 }
			);
		}

		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();

		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

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

			return json(errorData, { status: response.status });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Microduct connections DELETE API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}