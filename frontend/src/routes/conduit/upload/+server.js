import { API_URL } from '$env/static/private';
import { error } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
	try {
		// Get the uploaded file from the request
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			throw error(400, 'No file uploaded or invalid file');
		}

		// Validate file type
		if (
			!file.name.endsWith('.xlsx') &&
			file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		) {
			throw error(400, 'Invalid file format. Please upload an .xlsx file.');
		}

		// Validate file size (10MB max)
		if (file.size > 10 * 1024 * 1024) {
			throw error(400, 'File too large. Maximum size is 10MB.');
		}

		// Create new FormData for the backend request
		const backendFormData = new FormData();
		backendFormData.append('file', file);

		const accessToken = cookies.get('api-access-token');
		const headers = new Headers();
		if (accessToken) {
			headers.append('Cookie', `api-access-token=${accessToken}`);
		}

		// Forward the request to Django backend
		const response = await fetch(`${API_URL}import/conduit/`, {
			method: 'POST',
			body: backendFormData,
			headers: headers
		});

		const result = await response.json();

		if (!response.ok) {
			return new Response(JSON.stringify(result), {
				status: response.status,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (err) {
		console.error('Upload error:', err);

		if (err.status) {
			// SvelteKit error
			throw err;
		}

		// Generic server error
		throw error(500, 'Internal server error during file upload');
	}
}

/** @type {import('./$types').RequestHandler} */
export async function GET() {
	throw error(405, 'Method not allowed');
}
