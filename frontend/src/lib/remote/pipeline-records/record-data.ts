import type { PipelineRecord as BackendPipelineRecord } from '$lib/types';
import type { ComboboxItem } from '$lib/types/attributeCardTypes';

/** A pipeline record as the detail form reads it; related values arrive as display names. */
export interface PipelineRecord {
	uuid: string;
	project_name: string;
	type_of_work: string;
	request_reason: string;
	organisation: string;
	name: string;
	tel: string;
	mobile: string;
}

/** One row of the paginated pipeline-record list. */
export interface PipelineRecordRow {
	value: string;
	project_name: string;
	type_of_work: string;
	request_reason: string;
	organisation: string;
	name: string;
	created_at: string;
	modified_at: string;
}

/** A page of pipeline-record rows plus the backend's pagination envelope. */
export interface PipelineRecordListPage {
	records: PipelineRecordRow[];
	pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

/** Editable pipeline-record fields as sent by the create and detail forms. */
export interface PipelineRecordInput {
	typeOfWorkId: number | null;
	requestReasonId: number | null;
	organisation: string;
	name: string;
	tel: string;
	mobile: string;
}

const EMPTY_PAGINATION = { page: 1, pageSize: 50, totalCount: 0, totalPages: 0 };

/**
 * Maps a backend pipeline record to the form's shape, defaulting the
 * nullable text fields to empty strings.
 * @param record - The raw record from the backend.
 */
export function normalizeRecord(record: Partial<BackendPipelineRecord>): PipelineRecord {
	return {
		uuid: record.uuid ?? '',
		project_name: record.project_name ?? '',
		type_of_work: record.type_of_work ?? '',
		request_reason: record.request_reason ?? '',
		organisation: record.organisation ?? '',
		name: record.name ?? '',
		tel: record.tel ?? '',
		mobile: record.mobile ?? ''
	};
}

/**
 * Maps one list item to a table row, defaulting missing fields to empty strings.
 * @param item - A result of `pipeline-records/`.
 */
export function mapRecordListRow(item: Partial<BackendPipelineRecord>): PipelineRecordRow {
	return {
		value: item.uuid ?? '',
		project_name: item.project_name || '',
		type_of_work: item.type_of_work || '',
		request_reason: item.request_reason || '',
		organisation: item.organisation || '',
		name: item.name || '',
		created_at: item.created_at || '',
		modified_at: item.modified_at || ''
	};
}

/**
 * Maps the paginated `pipeline-records/` payload to rows plus pagination.
 * @param payload - The backend page envelope.
 */
export function mapRecordListPage(payload: Record<string, unknown>): PipelineRecordListPage {
	const results = Array.isArray(payload.results)
		? (payload.results as Partial<BackendPipelineRecord>[])
		: [];
	return {
		records: results.map(mapRecordListRow),
		pagination: {
			page: (payload.page as number) || EMPTY_PAGINATION.page,
			pageSize: (payload.page_size as number) || EMPTY_PAGINATION.pageSize,
			totalCount: (payload.count as number) || EMPTY_PAGINATION.totalCount,
			totalPages: (payload.total_pages as number) || EMPTY_PAGINATION.totalPages
		}
	};
}

/**
 * Builds the write body using the backend's write field names. Empty text
 * fields are sent as `null` so they can be cleared.
 * @param input - The form values.
 */
export function buildRecordBody(input: PipelineRecordInput): Record<string, unknown> {
	return {
		type_of_work_value: input.typeOfWorkId,
		request_reason_value: input.requestReasonId,
		organisation: input.organisation || null,
		name: input.name || null,
		tel: input.tel || null,
		mobile: input.mobile || null
	};
}

/**
 * Finds the option whose label matches a related value's display name. The
 * record serializer exposes related names, not ids, so the form resolves its
 * combobox selection by label.
 * @param options - Combobox options.
 * @param label - The display name from the record.
 * @returns The matching option value as a string, or `''` when none matches.
 */
export function resolveOptionValue(options: ComboboxItem[], label: string): string {
	if (!label) return '';
	const match = options.find((option) => option.label === label);
	return match ? String(match.value) : '';
}
