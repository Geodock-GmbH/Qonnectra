import type { PipelineRecord, PipelineRecordListPage } from './record-data';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import { buildRecordBody, mapRecordListPage, normalizeRecord } from './record-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());
const LookupIdSchema = v.nullable(v.pipe(v.number(), v.integer()));

const RecordListSchema = v.object({
	search: v.optional(v.string(), ''),
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50)
});

const RecordFieldsSchema = {
	typeOfWorkId: LookupIdSchema,
	requestReasonId: LookupIdSchema,
	organisation: v.string(),
	name: v.string(),
	tel: v.string(),
	mobile: v.string()
};

const CreateRecordSchema = v.object({
	projectId: v.pipe(v.number(), v.integer()),
	...RecordFieldsSchema
});

const UpdateRecordSchema = v.object({
	uuid: UuidSchema,
	...RecordFieldsSchema
});

/**
 * Fetch one page of pipeline records, optionally filtered by a search term.
 * @param input.search - Free-text search (empty for none).
 * @param input.page - 1-based page number.
 * @param input.pageSize - Rows per page.
 * @returns Table rows and the pagination envelope.
 * @throws When the backend request fails.
 */
export const getPipelineRecordList = query(
	RecordListSchema,
	async ({ search, page, pageSize }): Promise<PipelineRecordListPage> => {
		const headers = djangoHeaders();
		const url = new URL(`${API_URL}pipeline-records/`);
		if (search) url.searchParams.set('search', search);
		url.searchParams.set('page', String(page));
		url.searchParams.set('page_size', String(pageSize));

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to fetch pipeline records');

		return mapRecordListPage(await response.json());
	}
);

/**
 * Fetch a single pipeline record.
 * @param uuid - Pipeline record UUID.
 * @throws When the backend request fails, including a 404 for an unknown record.
 */
export const getPipelineRecord = query(UuidSchema, async (uuid): Promise<PipelineRecord> => {
	const response = await fetch(`${API_URL}pipeline-records/${encodeURIComponent(uuid)}/`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch pipeline record');

	return normalizeRecord(await response.json());
});

/**
 * Create a pipeline record in a project. The caller navigates to it afterwards.
 * @param input.projectId - Project the record belongs to.
 * @returns The created record.
 * @throws When the backend rejects the record.
 */
export const createPipelineRecord = command(
	CreateRecordSchema,
	async ({ projectId, ...fields }): Promise<PipelineRecord> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}pipeline-records/`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ project: projectId, ...buildRecordBody(fields) })
		});
		if (!response.ok) await failFromResponse(response, 'Failed to create pipeline record');

		return normalizeRecord(await response.json());
	}
);

/**
 * PATCH a pipeline record's editable fields and push the result into
 * `getPipelineRecord`. The project is fixed once the record exists.
 * @param input.uuid - Pipeline record UUID.
 * @returns The updated record.
 * @throws When the backend rejects the update.
 */
export const updatePipelineRecord = command(
	UpdateRecordSchema,
	async ({ uuid, ...fields }): Promise<PipelineRecord> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}pipeline-records/${encodeURIComponent(uuid)}/`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify(buildRecordBody(fields))
		});
		if (!response.ok) await failFromResponse(response, 'Failed to update pipeline record');

		const updated = normalizeRecord(await response.json());
		getPipelineRecord(uuid).set(updated);
		return updated;
	}
);

/**
 * Delete a pipeline record. The caller navigates away afterwards.
 * @param uuid - Pipeline record UUID.
 * @throws When the backend rejects the delete.
 */
export const deletePipelineRecord = command(UuidSchema, async (uuid) => {
	const response = await fetch(`${API_URL}pipeline-records/${encodeURIComponent(uuid)}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to delete pipeline record');
});
