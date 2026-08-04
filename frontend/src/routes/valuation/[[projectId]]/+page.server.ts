import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import {
	getAreaTypes,
	getConstructionTypes,
	getNodeTypes,
	getSurfaces
} from '$lib/server/attributes';
import { getLayerExtent } from '$lib/server/featureSearch';

/** Loads the selected project's areas, valuation cost rates, and node types. */
export const load: PageServerLoad = async ({ fetch, cookies }) => {
	const headers = getAuthHeaders(cookies);
	const projectId = cookies.get('selected-project') || '1';

	const [
		areasResponse,
		ratesResponse,
		nodeTypesData,
		surfacesData,
		constructionTypesData,
		areaTypesData
	] = await Promise.all([
		fetch(`${API_URL}area/?project=${projectId}`, { credentials: 'include', headers }),
		fetch(`${API_URL}valuation-rates/?project=${projectId}`, {
			credentials: 'include',
			headers
		}),
		getNodeTypes(fetch, cookies),
		getSurfaces(fetch, cookies),
		getConstructionTypes(fetch, cookies),
		getAreaTypes(fetch, cookies)
	]);

	const areasData = areasResponse.ok ? await areasResponse.json() : null;
	const areaFeatures =
		areasData?.results?.features ?? areasData?.features ?? areasData?.results ?? areasData ?? [];
	const areas = (Array.isArray(areaFeatures) ? areaFeatures : []).map(
		(a: Record<string, unknown>) => ({
			uuid:
				(a as Record<string, unknown>).id ??
				(a.properties as Record<string, unknown>)?.uuid ??
				a.uuid,
			name: (a.properties as Record<string, unknown>)?.name ?? a.name,
			areaType:
				((a.properties as Record<string, unknown>)?.area_type as Record<string, unknown>)
					?.area_type ?? null,
			geom: (a as Record<string, unknown>).geometry ?? null
		})
	);

	const ratesData = ratesResponse.ok ? await ratesResponse.json() : null;
	const ratesList = ratesData?.results ?? ratesData ?? [];
	const rates = Array.isArray(ratesList) ? ratesList : [];

	return {
		projectId,
		areas,
		rates,
		...nodeTypesData,
		...surfacesData,
		...constructionTypesData,
		...areaTypesData
	};
};

export const actions = {
	/**
	 * Runs the valuation calculation for the selected project and area(s).
	 * Expects form data: project, areaUuids (JSON array; empty = Gesamt),
	 * baseYear (optional), annualCorrection (optional, fraction).
	 */
	calculate: async ({ request, fetch, cookies }) => {
		const headers = getAuthHeaders(cookies);
		const formData = await request.formData();

		const project = Number(formData.get('project'));
		if (!project) {
			return fail(400, { message: 'Project is required' });
		}

		let areaUuids: string[] = [];
		try {
			const raw = String(formData.get('areaUuids') || '[]');
			areaUuids = JSON.parse(raw);
		} catch {
			return fail(400, { message: 'Invalid area selection' });
		}

		const baseYearRaw = formData.get('baseYear');
		const annualCorrectionRaw = formData.get('annualCorrection');

		const payload: Record<string, unknown> = { project, area_uuids: areaUuids };
		if (baseYearRaw !== null && baseYearRaw !== '') {
			payload.base_year = Number(baseYearRaw);
		}
		if (annualCorrectionRaw !== null && annualCorrectionRaw !== '') {
			payload.annual_correction = Number(annualCorrectionRaw);
		}

		try {
			const response = await fetch(`${API_URL}valuation/calculate/`, {
				method: 'POST',
				credentials: 'include',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return fail(response.status, {
					message: errorData.detail || 'Failed to calculate valuation'
				});
			}

			const result = await response.json();
			return { success: true, result };
		} catch (err: unknown) {
			console.error('Error calculating valuation:', err);
			return fail(500, { message: (err as Error).message || 'Failed to calculate valuation' });
		}
	},

	/**
	 * Returns the extent of a map layer so the layer tree can zoom to it.
	 * Expects form data: layerType, projectId.
	 */
	getLayerExtent: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const layerType = formData.get('layerType');
		const projectId = formData.get('projectId');

		return getLayerExtent(
			fetch,
			cookies,
			layerType as 'trench' | 'node' | 'address',
			projectId as string
		);
	}
} satisfies Actions;
