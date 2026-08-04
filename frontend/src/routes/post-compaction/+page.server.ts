import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';

/** Load status development options for the post-compaction page. */
export const load: PageServerLoad = async ({ fetch, cookies }) => {
	const headers = getAuthHeaders(cookies);

	try {
		const response = await fetch(`${API_URL}attributes_status_development/`, {
			credentials: 'include',
			headers
		});

		if (!response.ok) {
			return { statusDevelopments: [] };
		}

		const data = await response.json();
		const statusDevelopments = data.map((item: Record<string, unknown>) => ({
			value: String(item.id),
			label: item.status
		}));

		return { statusDevelopments };
	} catch {
		return { statusDevelopments: [] };
	}
};

export const actions = {
	/** PATCH an address's status_development field. */
	updateStatus: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const uuid = formData.get('uuid');
		const statusDevelopmentId = formData.get('status_development_id');

		try {
			const response = await fetch(`${API_URL}address/${uuid}/`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status_development_id: parseInt(String(statusDevelopmentId))
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const message =
					errorData.detail ||
					Object.entries(errorData)
						.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
						.join('; ') ||
					'Failed to update status';
				return fail(response.status, { message });
			}

			const updatedData = await response.json();
			const address = {
				...(updatedData.properties || updatedData),
				uuid: updatedData.id || updatedData.properties?.uuid || updatedData.uuid
			};

			return { success: true, address };
		} catch (err: unknown) {
			return fail(500, { message: (err as Error).message || 'Failed to update status' });
		}
	},

	/** Fetch a single address with its residential units and linked microducts by UUID. */
	fetchAddress: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();
		const uuid = formData.get('uuid');

		try {
			const [addressResponse, residentialUnitsResponse, nodesResponse, trenchResponse] =
				await Promise.all([
					fetch(`${API_URL}address/${uuid}/`, {
						credentials: 'include',
						headers
					}),
					fetch(`${API_URL}residential-unit/all/?uuid_address=${uuid}`, {
						credentials: 'include',
						headers
					}),
					fetch(`${API_URL}node/?uuid_address=${uuid}`, {
						credentials: 'include',
						headers
					}),
					fetch(`${API_URL}address/${uuid}/linked-trenches/`, {
						credentials: 'include',
						headers
					})
				]);

			if (!addressResponse.ok) {
				const errorData = await addressResponse.json().catch(() => ({}));
				return fail(addressResponse.status, {
					message: errorData.detail || 'Failed to fetch address'
				});
			}

			const addressData = await addressResponse.json();
			const address = {
				...(addressData.properties || addressData),
				uuid: addressData.id || addressData.properties?.uuid || addressData.uuid,
				geom_3857: addressData.properties?.geom_3857 || addressData.geom_3857 || null
			};

			let residentialUnits: Record<string, unknown>[] = [];
			if (residentialUnitsResponse.ok) {
				residentialUnits = await residentialUnitsResponse.json();
			}

			let linkedMicroducts: Record<string, unknown>[] = [];
			if (nodesResponse.ok) {
				const nodesData = await nodesResponse.json();
				const features = nodesData.features || nodesData.results?.features || [];
				const linkedNodes = features.map((f: Record<string, unknown>) => ({
					uuid:
						(f as Record<string, unknown>).id || (f.properties as Record<string, unknown>)?.uuid,
					name: (f.properties as Record<string, unknown>)?.name || '',
					parentNodeName:
						((f.properties as Record<string, unknown>)?.parent_node as Record<string, unknown>)
							?.name || ''
				}));

				if (linkedNodes.length > 0) {
					const microductResponses = await Promise.all(
						linkedNodes.map((node: Record<string, unknown>) =>
							fetch(`${API_URL}microduct/all/?uuid_node=${node.uuid}`, {
								credentials: 'include',
								headers
							})
						)
					);
					for (let i = 0; i < microductResponses.length; i++) {
						if (microductResponses[i].ok) {
							const microducts = await microductResponses[i].json();
							for (const md of microducts) {
								linkedMicroducts.push({
									uuid: md.uuid,
									number: md.number,
									color: md.color,
									colorHex: md.hex_code || '#64748b',
									conduitName: md.uuid_conduit?.name || '',
									conduitType: md.uuid_conduit?.conduit_type?.conduit_type || '',
									nodeName: linkedNodes[i].name,
									nodeUuid: linkedNodes[i].uuid,
									parentNodeName: linkedNodes[i].parentNodeName
								});
							}
						}
					}
				}
			}

			let linkedTrenchGeometries: Record<string, unknown>[] = [];
			if (trenchResponse.ok) {
				const trenchData = await trenchResponse.json();
				linkedTrenchGeometries = trenchData.features || [];
			}

			return { success: true, address, residentialUnits, linkedMicroducts, linkedTrenchGeometries };
		} catch (err: unknown) {
			return fail(500, { message: (err as Error).message || 'Failed to fetch address' });
		}
	}
} satisfies Actions;
