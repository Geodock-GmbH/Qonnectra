import { describe, expect, test } from 'vitest';

import {
	buildRecordBody,
	mapRecordListPage,
	mapRecordListRow,
	normalizeRecord,
	resolveOptionValue
} from './record-data';

describe('normalizeRecord', () => {
	test('should keep the display names and default nullable text fields to empty strings', () => {
		const record = normalizeRecord({
			uuid: 'rec-1',
			project_name: 'Fiber North',
			type_of_work: 'Excavation',
			request_reason: 'Expansion',
			organisation: 'Acme Telecom',
			name: null,
			tel: null,
			mobile: '0170'
		});

		expect(record).toEqual({
			uuid: 'rec-1',
			project_name: 'Fiber North',
			type_of_work: 'Excavation',
			request_reason: 'Expansion',
			organisation: 'Acme Telecom',
			name: '',
			tel: '',
			mobile: '0170'
		});
	});

	test('should default every field of an empty payload', () => {
		expect(normalizeRecord({})).toEqual({
			uuid: '',
			project_name: '',
			type_of_work: '',
			request_reason: '',
			organisation: '',
			name: '',
			tel: '',
			mobile: ''
		});
	});
});

describe('mapRecordListRow', () => {
	test('should expose the uuid as the row value', () => {
		const row = mapRecordListRow({
			uuid: 'rec-1',
			project_name: 'Fiber North',
			organisation: 'Acme Telecom',
			created_at: '2026-01-15T10:30:00Z'
		});

		expect(row.value).toBe('rec-1');
		expect(row.project_name).toBe('Fiber North');
		expect(row.organisation).toBe('Acme Telecom');
		expect(row.created_at).toBe('2026-01-15T10:30:00Z');
	});

	test('should default missing and null fields to empty strings', () => {
		expect(mapRecordListRow({ uuid: 'rec-2', organisation: null })).toEqual({
			value: 'rec-2',
			project_name: '',
			type_of_work: '',
			request_reason: '',
			organisation: '',
			name: '',
			created_at: '',
			modified_at: ''
		});
	});
});

describe('mapRecordListPage', () => {
	test('should map rows and the pagination envelope', () => {
		const page = mapRecordListPage({
			results: [{ uuid: 'rec-1' }, { uuid: 'rec-2' }],
			page: 2,
			page_size: 20,
			count: 42,
			total_pages: 3
		});

		expect(page.records.map((row) => row.value)).toEqual(['rec-1', 'rec-2']);
		expect(page.pagination).toEqual({ page: 2, pageSize: 20, totalCount: 42, totalPages: 3 });
	});

	test('should fall back to an empty first page when the envelope is missing', () => {
		expect(mapRecordListPage({})).toEqual({
			records: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 }
		});
	});
});

describe('buildRecordBody', () => {
	test('should use the backend write field names', () => {
		const body = buildRecordBody({
			typeOfWorkId: 3,
			requestReasonId: 7,
			organisation: 'Acme Telecom',
			name: 'Jane Doe',
			tel: '0123',
			mobile: '0170'
		});

		expect(body).toEqual({
			type_of_work_value: 3,
			request_reason_value: 7,
			organisation: 'Acme Telecom',
			name: 'Jane Doe',
			tel: '0123',
			mobile: '0170'
		});
	});

	test('should send null for unselected lookups and empty text so they can be cleared', () => {
		const body = buildRecordBody({
			typeOfWorkId: null,
			requestReasonId: null,
			organisation: '',
			name: '',
			tel: '',
			mobile: ''
		});

		expect(body).toEqual({
			type_of_work_value: null,
			request_reason_value: null,
			organisation: null,
			name: null,
			tel: null,
			mobile: null
		});
	});

	test('should never send the project, which is fixed after creation', () => {
		const body = buildRecordBody({
			typeOfWorkId: null,
			requestReasonId: null,
			organisation: '',
			name: '',
			tel: '',
			mobile: ''
		});

		expect(body).not.toHaveProperty('project');
	});
});

describe('resolveOptionValue', () => {
	const options = [
		{ value: 3, label: 'Excavation' },
		{ value: 4, label: 'Drilling' }
	];

	test('should return the value of the option with a matching label as a string', () => {
		expect(resolveOptionValue(options, 'Drilling')).toBe('4');
	});

	test('should return an empty string when no label matches', () => {
		expect(resolveOptionValue(options, 'Blasting')).toBe('');
	});

	test('should return an empty string for an empty label', () => {
		expect(resolveOptionValue(options, '')).toBe('');
	});
});
