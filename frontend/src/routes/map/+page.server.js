import { redirect } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, fetch }) {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	try {
		const response = await fetch(`${PUBLIC_API_URL}ol_trench/?id_trench`);

		if (!response.ok) {
			console.error(`Failed to fetch map data: ${response.status} ${response.statusText}`);
			return { trenches: [], error: `Failed to load data: ${response.statusText}` };
		}

		const trenches = await response.json();

		return {
			trenches: trenches
		};
	} catch (error) {
		// Handle network errors or JSON parsing errors
		console.error('Error fetching map data:', error);
		// Return an error state or throw an error
		return { trenches: [], error: 'Could not connect to the server or parse data.' };
	}
}
