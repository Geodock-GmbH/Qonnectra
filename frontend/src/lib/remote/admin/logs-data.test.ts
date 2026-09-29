import { describe, expect, test } from 'vitest';

import {
	DEFAULT_LOG_FILTERS,
	logFiltersToQuery,
	logFiltersToSearchParams,
	readLogFilters
} from './logs-data';

function logsUrl(search = ''): URL {
	return new URL(`http://localhost/admin/logs${search}`);
}

describe('readLogFilters', () => {
	test('defaults every filter and the page', () => {
		expect(readLogFilters(logsUrl())).toEqual(DEFAULT_LOG_FILTERS);
	});

	test('reads all parameters', () => {
		expect(
			readLogFilters(
				logsUrl(
					'?level=ERROR&source=backend&search=test&date_from=2026-01-01&date_to=2026-01-31&project=1&page=2'
				)
			)
		).toEqual({
			level: 'ERROR',
			source: 'backend',
			search: 'test',
			dateFrom: '2026-01-01',
			dateTo: '2026-01-31',
			project: '1',
			page: 2
		});
	});

	test('falls back to page 1 for a non-numeric or non-positive page', () => {
		expect(readLogFilters(logsUrl('?page=abc')).page).toBe(1);
		expect(readLogFilters(logsUrl('?page=0')).page).toBe(1);
	});
});

describe('logFiltersToQuery', () => {
	test('names every filter so empty ones get deleted from the URL', () => {
		expect(logFiltersToQuery({ ...DEFAULT_LOG_FILTERS, level: 'ERROR', page: 3 })).toEqual({
			level: 'ERROR',
			source: '',
			search: '',
			date_from: '',
			date_to: '',
			project: '',
			page: 3
		});
	});
});

describe('logFiltersToSearchParams', () => {
	test('omits empty filters and always sets the page', () => {
		const params = logFiltersToSearchParams({ ...DEFAULT_LOG_FILTERS, level: 'ERROR', page: 3 });

		expect(params.toString()).toBe('level=ERROR&page=3');
	});

	test('round-trips through readLogFilters', () => {
		const filters = {
			level: 'WARNING',
			source: 'frontend',
			search: 'timeout',
			dateFrom: '2026-01-01T00:00',
			dateTo: '',
			project: '7',
			page: 2
		};

		expect(readLogFilters(logsUrl(`?${logFiltersToSearchParams(filters)}`))).toEqual(filters);
	});
});
