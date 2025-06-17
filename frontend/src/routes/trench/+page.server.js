import { fail } from '@sveltejs/kit';
import { PUBLIC_API_URL } from '$env/static/public';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
	// We will load conduits via an action when project/flag are selected.
	return {
		conduits: [],
		conduitsError: null
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	getConduits: async ({ request, fetch }) => {
		const data = await request.formData();
		const projectId = data.get('projectId');
		const flagId = data.get('flagId');

		if (!projectId || !flagId) {
			return fail(400, { error: 'Project and Flag must be selected.' });
		}

		let conduits = [];
		let conduitsError = null;

		const conduitsResponse = await fetch(
			`${PUBLIC_API_URL}conduit/?project=${projectId}&flag=${flagId}`,
			{
				credentials: 'include'
			}
		);

		if (conduitsResponse.ok) {
			try {
				const conduitsData = await conduitsResponse.json();
				const conduitData = conduitsData.results || conduitsData;
				conduits = conduitData.map((conduit) => ({
					label: `${conduit.name}${conduit.conduit_type?.conduit_type ? ` (${conduit.conduit_type.conduit_type})` : ''}`,
					value: conduit.uuid,
					meta: conduit
				}));
			} catch (e) {
				conduitsError = 'Error parsing conduits data';
				console.error('Failed to parse conduits data:', e);
			}
		} else {
			conduitsError = 'Failed to fetch conduits';
		}

		return {
			conduits,
			conduitsError
		};
	}
};
