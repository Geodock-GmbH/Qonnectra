import { redirect } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';

/** @type {import('./$types').RequestHandler} */
export async function POST({ cookies, fetch }) {
	// Retrieve necessary cookies to forward/clear
	const refreshToken = cookies.get('api-refresh-token');
	const csrfToken = cookies.get('csrftoken');
	const accessToken = cookies.get('api-access-token');

	// Prepare headers for the API request
	const headers = {
		'Content-Type': 'application/json'
	};
	if (csrfToken) {
		headers['X-CSRFToken'] = csrfToken;
	}

	if (refreshToken) {
		headers['Cookie'] = `api-refresh-token=${refreshToken}`; // Adjust if other cookies are needed
	}

	try {
		const response = await fetch(`${PUBLIC_API_URL}auth/logout/`, {
			method: 'POST',
			headers: headers
		});

		if (!response.ok && response.status !== 401) {
			// Ignore 401 Unauthorized, as it might mean the tokens were already invalid
			console.error('Backend logout failed:', response.status, await response.text());
		}
	} catch (error) {
		console.error('Error during logout API call:', error);
	}

	// Clear the cookies on the client-side
	cookies.delete('api-access-token', { path: '/' });
	cookies.delete('api-refresh-token', { path: '/' }); // Clear refresh token

	// Redirect to the login page
	throw redirect(303, '/login');
}
