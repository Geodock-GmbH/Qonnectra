import { API_URL } from '$env/static/private';
import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

export async function GET({ cookies, fetch }) {
	const accessToken = cookies.get('api-access-token');
	const headers = getAuthHeaders(cookies);

	const response = await fetch(`${API_URL}template/conduit`, { headers });

	if (!response.ok) {
		return new Response(await response.text(), { status: response.status });
	}

	const blob = await response.blob();

	const responseHeaders = new Headers();
	responseHeaders.set(
		'Content-Type',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	);
	const contentDisposition = response.headers.get('content-disposition');
	if (contentDisposition) {
		responseHeaders.set('Content-Disposition', contentDisposition);
	} else {
		responseHeaders.set('Content-Disposition', `attachment; filename="conduit-template.xlsx"`);
	}

	return new Response(blob, {
		status: 200,
		headers: responseHeaders
	});
}
