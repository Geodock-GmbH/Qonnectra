import { API_URL } from '$env/static/private';

export async function GET({ cookies, fetch }) {
	const accessToken = cookies.get('api-access-token');
	const headers = new Headers();
	if (accessToken) {
		headers.append('Cookie', `api-access-token=${accessToken}`);
	}

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
