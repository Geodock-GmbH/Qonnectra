import { describe, expect, test } from 'vitest';

import {
	buildRequestBody,
	flattenError,
	mapLookupOptions,
	mapProjectOptions
} from './pipelineRecordApi';

/**
 * Minimal FormData-like stub backed by a plain record. Missing keys return null,
 * matching the browser FormData.get contract the module relies on.
 */
function makeFormData(values: Record<string, string>) {
	return {
		get: (key: string) => (key in values ? values[key] : null)
	};
}

describe('mapLookupOptions', () => {
	test('maps id/name pairs to value/label options', () => {
		const result = mapLookupOptions([
			{ id: 1, name: 'Excavation' },
			{ id: 2, name: 'Repair' }
		]);

		expect(result).toEqual([
			{ value: 1, label: 'Excavation' },
			{ value: 2, label: 'Repair' }
		]);
	});

	test('returns an empty array for a null/undefined list', () => {
		expect(mapLookupOptions(null as never)).toEqual([]);
		expect(mapLookupOptions(undefined as never)).toEqual([]);
	});

	test('returns an empty array for an empty list', () => {
		expect(mapLookupOptions([])).toEqual([]);
	});
});

describe('mapProjectOptions', () => {
	test('maps a plain array of project rows', () => {
		const result = mapProjectOptions([
			{ id: 7, project: 'Ausbau Nord' },
			{ id: 9, project: 'Ausbau Süd' }
		]);

		expect(result).toEqual([
			{ value: 7, label: 'Ausbau Nord' },
			{ value: 9, label: 'Ausbau Süd' }
		]);
	});

	test('unwraps a paginated results envelope', () => {
		const result = mapProjectOptions({
			results: [{ id: 3, project: 'Innenstadt' }]
		});

		expect(result).toEqual([{ value: 3, label: 'Innenstadt' }]);
	});

	test('returns an empty array when the envelope has no results', () => {
		expect(mapProjectOptions({ results: [] })).toEqual([]);
		expect(mapProjectOptions({} as never)).toEqual([]);
	});

	test('returns an empty array for null input', () => {
		expect(mapProjectOptions(null as never)).toEqual([]);
	});
});

describe('buildRequestBody', () => {
	test('parses the project FK and all numeric/text fields', () => {
		const formData = makeFormData({
			project: '7',
			type_of_work_value: '2',
			request_reason_value: '5',
			organisation: 'Stadtwerke',
			name: 'Mustermann',
			tel: '030-1234',
			mobile: '0170-5678'
		});

		expect(buildRequestBody(formData)).toEqual({
			project: 7,
			type_of_work_value: 2,
			request_reason_value: 5,
			organisation: 'Stadtwerke',
			name: 'Mustermann',
			tel: '030-1234',
			mobile: '0170-5678'
		});
	});

	test('omits the project key entirely when project is absent', () => {
		const formData = makeFormData({
			type_of_work_value: '1'
		});

		const body = buildRequestBody(formData);

		expect('project' in body).toBe(false);
	});

	test('coerces empty-string and missing fields to null', () => {
		const formData = makeFormData({
			project: '',
			type_of_work_value: '',
			request_reason_value: '',
			organisation: '',
			name: '',
			tel: '',
			mobile: ''
		});

		expect(buildRequestBody(formData)).toEqual({
			type_of_work_value: null,
			request_reason_value: null,
			organisation: null,
			name: null,
			tel: null,
			mobile: null
		});
	});

	test('defaults all optional fields to null when nothing is submitted', () => {
		const body = buildRequestBody(makeFormData({}));

		expect(body).toEqual({
			type_of_work_value: null,
			request_reason_value: null,
			organisation: null,
			name: null,
			tel: null,
			mobile: null
		});
	});
});

describe('flattenError', () => {
	test('prefers the DRF detail string', () => {
		expect(flattenError({ detail: 'Not authorized' }, 'fallback')).toBe('Not authorized');
	});

	test('flattens field-keyed array messages into a single string', () => {
		expect(
			flattenError({ organisation: ['This field is required.'], tel: ['Too short'] }, 'fallback')
		).toBe('organisation: This field is required.; tel: Too short');
	});

	test('joins array values per field with commas', () => {
		expect(flattenError({ name: ['A', 'B'] }, 'fallback')).toBe('name: A, B');
	});

	test('stringifies non-array field values', () => {
		expect(flattenError({ project: 'must be a number' }, 'fallback')).toBe(
			'project: must be a number'
		);
	});

	test('uses the fallback for null error data', () => {
		expect(flattenError(null, 'Something went wrong')).toBe('Something went wrong');
	});

	test('uses the fallback for an empty error object', () => {
		expect(flattenError({}, 'Something went wrong')).toBe('Something went wrong');
	});
});
