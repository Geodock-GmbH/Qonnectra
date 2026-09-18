import { describe, expect, test } from 'vitest';

import { logFiltersToSearchParams, readLogFilters } from './logs-data';

describe('readLogFilters', () => {
	test('defaults every filter and the page', () => {
		expect(readLogFilters(new URLSearchParams())).toEqual({
			level: '',
			source: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			project: '',
			page: 1
		});
	});

	test('reads all parameters', () => {
		expect(
			readLogFilters(
				new URLSearchParams(
					'level=ERROR&source=backend&search=test&date_from=2026-01-01&date_to=2026-01-31&project=1&page=2'
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

	test('falls back to page 1 for a non-numeric page', () => {
		expect(readLogFilters(new URLSearchParams('page=abc')).page).toBe(1);
	});
});

describe('logFiltersToSearchParams', () => {
	test('omits empty filters and always sets the page', () => {
		const params = logFiltersToSearchParams({
			level: 'ERROR',
			source: '',
			search: '',
			dateFrom: '',
			dateTo: '',
			project: '',
			page: 3
		});

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

		expect(readLogFilters(logFiltersToSearchParams(filters))).toEqual(filters);
	});
});
