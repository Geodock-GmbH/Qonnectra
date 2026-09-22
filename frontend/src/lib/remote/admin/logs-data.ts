import type { QueryChanges } from '$lib/utils/urlState';

import { queryInt, queryString } from '$lib/utils/urlState';

/** Filter and paging state of the admin log view, mirrored in the page URL. */
export interface LogFilters {
	level: string;
	source: string;
	search: string;
	dateFrom: string;
	dateTo: string;
	project: string;
	page: number;
}

/** Page size the backend uses for the logs endpoint. */
export const LOG_PAGE_SIZE = 10;

/** Every filter set to "any", on the first page. */
export const DEFAULT_LOG_FILTERS: Readonly<LogFilters> = {
	level: '',
	source: '',
	search: '',
	dateFrom: '',
	dateTo: '',
	project: '',
	page: 1
};

/**
 * Reads the log filters from the page URL, defaulting every filter to "any"
 * and the page to 1.
 * @param url - The page URL.
 * @returns The filters the URL describes.
 */
export function readLogFilters(url: URL): LogFilters {
	return {
		level: queryString(url, 'level'),
		source: queryString(url, 'source'),
		search: queryString(url, 'search'),
		dateFrom: queryString(url, 'date_from'),
		dateTo: queryString(url, 'date_to'),
		project: queryString(url, 'project'),
		page: queryInt(url, 'page', 1, { min: 1 })
	};
}

/**
 * Maps the filters onto their query parameter names, so `setQuery` writes
 * every filter and deletes the ones that are empty.
 * @param filters - The filters to write.
 * @returns The query changes describing the filters.
 */
export function logFiltersToQuery(filters: LogFilters): QueryChanges {
	return {
		level: filters.level,
		source: filters.source,
		search: filters.search,
		date_from: filters.dateFrom,
		date_to: filters.dateTo,
		project: filters.project,
		page: filters.page
	};
}

/**
 * Serializes the filters for the backend request, which shares the page
 * URL's parameter names. Empty filters are omitted and the page is always
 * sent.
 * @param filters - The filters to serialize.
 * @returns The request query string.
 */
export function logFiltersToSearchParams(filters: LogFilters): URLSearchParams {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(logFiltersToQuery(filters))) {
		if (key === 'page') continue;
		if (value) params.set(key, String(value));
	}
	params.set('page', String(filters.page));
	return params;
}
