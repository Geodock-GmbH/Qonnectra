import { queryInt, queryList, queryString } from '$lib/utils/urlState';

/** Yearly value correction in percent when the URL names none. */
export const DEFAULT_CORRECTION_PERCENT = 2.5;

/** Areas a shareable link may carry; a longer selection stays on the page. */
export const MAX_URL_AREAS = 40;

/** What the valuation page values and projects, as the URL names it. */
export interface ValuationRequest {
	/** Areas the valuation is restricted to; empty values the whole project. */
	areaUuids: string[];
	/** Build-completion year the projection starts from. */
	baseYear: number;
	/** Yearly value correction in percent. */
	correction: number;
}

/**
 * The build-completion year the projection starts from when the URL names none.
 * @returns The current year.
 */
export function defaultBaseYear(): number {
	return new Date().getFullYear();
}

/**
 * Reads the valuation inputs from the URL: `?areas=uuid,uuid&baseYear=2024&correction=2.5`.
 * A missing or malformed value falls back to its default; duplicate areas
 * count once.
 * @param url - The page URL.
 * @returns The typed request.
 */
export function valuationRequestFromUrl(url: URL): ValuationRequest {
	const correction = Number(queryString(url, 'correction', String(DEFAULT_CORRECTION_PERCENT)));
	return {
		areaUuids: [...new Set(queryList(url, 'areas'))],
		baseYear: queryInt(url, 'baseYear', defaultBaseYear(), { min: 1900, max: 2200 }),
		correction: Number.isFinite(correction) ? correction : DEFAULT_CORRECTION_PERCENT
	};
}
