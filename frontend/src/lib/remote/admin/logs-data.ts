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

/**
 * Reads the log filters from the page's query string, defaulting every
 * filter to "any" and the page to 1.
 * @param searchParams - The page URL's search params.
 */
export function readLogFilters(searchParams: URLSearchParams): LogFilters {
	return {
		level: searchParams.get('level') ?? '',
		source: searchParams.get('source') ?? '',
		search: searchParams.get('search') ?? '',
		dateFrom: searchParams.get('date_from') ?? '',
		dateTo: searchParams.get('date_to') ?? '',
		project: searchParams.get('project') ?? '',
		page: Number(searchParams.get('page')) || 1
	};
}

/**
 * Serializes the filters for both the page URL and the backend request,
 * which share the same parameter names. Empty filters are omitted.
 * @param filters - The filters to serialize.
 */
export function logFiltersToSearchParams(filters: LogFilters): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.level) params.set('level', filters.level);
	if (filters.source) params.set('source', filters.source);
	if (filters.search) params.set('search', filters.search);
	if (filters.dateFrom) params.set('date_from', filters.dateFrom);
	if (filters.dateTo) params.set('date_to', filters.dateTo);
	if (filters.project) params.set('project', filters.project);
	params.set('page', String(filters.page));
	return params;
}
