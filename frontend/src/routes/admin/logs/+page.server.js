import { redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies, url, locals }) {
	if (!locals.user?.isAdmin) {
		throw redirect(303, '/map');
	}

	const headers = getAuthHeaders(cookies);

	const page = url.searchParams.get('page') || '1';
	const level = url.searchParams.get('level') || '';
	const source = url.searchParams.get('source') || '';
	const search = url.searchParams.get('search') || '';
	const dateFrom = url.searchParams.get('date_from') || '';
	const dateTo = url.searchParams.get('date_to') || '';
	const project = url.searchParams.get('project') || '';

	const params = new URLSearchParams();
	params.set('page', page);
	if (level) params.set('level', level);
	if (source) params.set('source', source);
	if (search) params.set('search', search);
	if (dateFrom) params.set('date_from', dateFrom);
	if (dateTo) params.set('date_to', dateTo);
	if (project) params.set('project', project);

	try {
		const projectsResponse = await fetch(`${API_URL}projects/?active=true`, {
			credentials: 'include',
			headers: headers
		});

		const logsResponse = await fetch(`${API_URL}logs/?${params.toString()}`, {
			credentials: 'include',
			headers: headers
		});

		if (!logsResponse.ok) {
			console.error(`Failed to fetch logs: ${logsResponse.status}`);
			return {
				logs: [],
				count: 0,
				next: null,
				previous: null,
				projects: [],
				filters: { level, source, search, dateFrom, dateTo, project, page }
			};
		}

		const logsData = await logsResponse.json();
		const projectsData = projectsResponse.ok ? await projectsResponse.json() : [];

		return {
			logs: logsData.results || [],
			count: logsData.count || 0,
			next: logsData.next,
			previous: logsData.previous,
			projects: projectsData,
			filters: { level, source, search, dateFrom, dateTo, project, page }
		};
	} catch (error) {
		console.error('Error fetching logs:', error);
		return {
			logs: [],
			count: 0,
			next: null,
			previous: null,
			projects: [],
			filters: { level, source, search, dateFrom, dateTo, project, page }
		};
	}
}
