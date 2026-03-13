import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/**
 * Proxies the conduit Excel template download from the backend API.
 * @param {object} event - SvelteKit request event.
 * @param {import('@sveltejs/kit').Cookies} event.cookies - Request cookies for auth.
 * @param {typeof globalThis.fetch} event.fetch - SvelteKit fetch function.
 * @returns {Promise<Response>} The Excel template file as a download response.
 */
export async function GET({ cookies, fetch }) {
	const headers = getAuthHeaders(cookies);

	try {
		const response = await fetch(`${API_URL}template/conduit/`, { headers });

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Template download failed:', response.status, errorText);
			throw error(response.status, 'Failed to download template');
		}

		const blob = await response.blob();

		const responseHeaders = new Headers();
		responseHeaders.set(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		);

		const contentDisposition = response.headers.get('content-disposition');
		responseHeaders.set(
			'Content-Disposition',
			contentDisposition || 'attachment; filename="conduit-template.xlsx"'
		);

		return new Response(blob, {
			status: 200,
			headers: responseHeaders
		});
	} catch (err) {
		console.error('Download error:', err);
		if (/** @type {any} */ (err).status) {
			throw err;
		}
		throw error(500, 'Failed to download template');
	}
}
