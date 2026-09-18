import { describe, expect, test } from 'vitest';

import {
	buildConduitCreateBody,
	buildConduitPatch,
	importErrorMessage,
	importFileIssue,
	isDuplicateConduitError,
	mapConduitListPage,
	mapConduitListRow,
	mapImportResult,
	MAX_IMPORT_FILE_SIZE
} from './conduit-data';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('mapConduitListRow', () => {
	test('should copy the flattened list fields and default missing ones to empty strings', () => {
		expect(
			mapConduitListRow({
				uuid: 'c-1',
				name: 'DA 50',
				conduit_type: 'Rohr',
				constructor: 'Baufirma',
				date: null
			})
		).toEqual({
			value: 'c-1',
			name: 'DA 50',
			conduit_type: 'Rohr',
			outer_conduit: '',
			status: '',
			network_level: '',
			owner: '',
			constructor: 'Baufirma',
			manufacturer: '',
			date: '',
			flag: ''
		});
	});
});

describe('mapConduitListPage', () => {
	test('should map results and the pagination envelope', () => {
		const page = mapConduitListPage({
			results: [{ uuid: 'c-1', name: 'A' }],
			page: 2,
			page_size: 25,
			count: 51,
			total_pages: 3
		});

		expect(page.conduits).toHaveLength(1);
		expect(page.conduits[0].value).toBe('c-1');
		expect(page.pagination).toEqual({ page: 2, pageSize: 25, totalCount: 51, totalPages: 3 });
	});

	test('should default to an empty first page without results', () => {
		expect(mapConduitListPage({})).toEqual({
			conduits: [],
			pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 }
		});
	});
});

describe('buildConduitCreateBody', () => {
	test('should send the name plus every set optional field', () => {
		expect(
			buildConduitCreateBody(1, {
				name: 'Test',
				outer_conduit: 'outer',
				date: '2024-01-01',
				conduit_type_id: 2,
				status_id: 3,
				network_level_id: 4,
				owner_id: 5,
				constructor_id: 6,
				manufacturer_id: 7,
				flag_id: 8
			})
		).toEqual({
			name: 'Test',
			project_id: 1,
			outer_conduit: 'outer',
			conduit_type_id: 2,
			status_id: 3,
			network_level_id: 4,
			owner_id: 5,
			constructor_id: 6,
			manufacturer_id: 7,
			flag_id: 8,
			date: '2024-01-01'
		});
	});

	test('should omit the project and empty optional fields', () => {
		expect(buildConduitCreateBody(undefined, { name: 'Test', outer_conduit: '' })).toEqual({
			name: 'Test'
		});
	});
});

describe('buildConduitPatch', () => {
	test('should always send outer_conduit so it can be cleared', () => {
		expect(buildConduitPatch({ name: 'Test', outer_conduit: '' })).toEqual({
			name: 'Test',
			outer_conduit: ''
		});
	});

	test('should send set references as ids and skip unset ones', () => {
		expect(
			buildConduitPatch({ name: 'Test', conduit_type_id: 1, status_id: 2, date: '2024-01-01' })
		).toEqual({
			name: 'Test',
			outer_conduit: '',
			conduit_type_id: 1,
			status_id: 2,
			date: '2024-01-01'
		});
	});
});

describe('isDuplicateConduitError', () => {
	test('should detect a 400 with name or non-field errors', () => {
		expect(isDuplicateConduitError(400, { name: ['exists'] })).toBe(true);
		expect(isDuplicateConduitError(400, { non_field_errors: ['unique'] })).toBe(true);
	});

	test('should ignore other statuses and bodies', () => {
		expect(isDuplicateConduitError(400, { detail: 'Invalid data' })).toBe(false);
		expect(isDuplicateConduitError(500, { name: ['x'] })).toBe(false);
		expect(isDuplicateConduitError(400, null)).toBe(false);
	});
});

describe('importFileIssue', () => {
	test('should accept an .xlsx file by extension or mime type', () => {
		expect(importFileIssue(new File(['x'], 'conduits.xlsx', { type: '' }))).toBeNull();
		expect(importFileIssue(new File(['x'], 'conduits', { type: XLSX_MIME }))).toBeNull();
	});

	test('should reject an empty upload', () => {
		expect(importFileIssue(new File([], '', { type: '' }))).toBe(
			'No file uploaded or invalid file'
		);
	});

	test('should reject a non-xlsx file', () => {
		expect(importFileIssue(new File(['x'], 'conduits.csv', { type: 'text/csv' }))).toBe(
			'Invalid file format. Please upload an .xlsx file.'
		);
	});

	test('should reject a file above the size limit', () => {
		const big = new File([new ArrayBuffer(MAX_IMPORT_FILE_SIZE + 1)], 'conduits.xlsx', {
			type: XLSX_MIME
		});
		expect(importFileIssue(big)).toBe('File too large. Maximum size is 10MB.');
	});
});

describe('importErrorMessage', () => {
	test('should join row errors and warnings', () => {
		expect(
			importErrorMessage({ error: 'Some rows failed', errors: ['Row 1'], warnings: ['Row 2'] })
		).toBe('Row 1\nRow 2');
	});

	test('should fall back to the summary and then a default', () => {
		expect(importErrorMessage({ error: 'Some rows failed' })).toBe('Some rows failed');
		expect(importErrorMessage({})).toBe('Import failed');
		expect(importErrorMessage(null)).toBe('Import failed');
	});
});

describe('mapImportResult', () => {
	test('should map the backend summary with defaults', () => {
		expect(mapImportResult({ created_count: 5, message: 'ok', warnings: ['w'] })).toEqual({
			createdCount: 5,
			message: 'ok',
			warnings: ['w']
		});
		expect(mapImportResult({})).toEqual({ createdCount: 0, message: '', warnings: [] });
	});
});
