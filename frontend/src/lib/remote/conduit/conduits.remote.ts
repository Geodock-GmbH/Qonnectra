import type { ConduitImportResult, ConduitListPage, ConduitRecord } from './conduit-data';
import { error, invalid } from '@sveltejs/kit';
import { command, form, query, requested } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import {
	backendErrorMessage,
	errorStatus,
	failFromResponse
} from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import {
	buildConduitCreateBody,
	buildConduitPatch,
	importErrorMessage,
	importFileIssue,
	isDuplicateConduitError,
	mapConduitListPage,
	mapImportResult
} from './conduit-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const ConduitListSchema = v.object({
	projectId: v.pipe(v.string(), v.nonEmpty()),
	search: v.optional(v.string(), ''),
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50)
});

const ConduitFieldsSchema = {
	name: v.pipe(v.string(), v.nonEmpty()),
	outer_conduit: v.optional(v.string()),
	date: v.optional(v.string()),
	conduit_type_id: v.optional(v.number()),
	status_id: v.optional(v.number()),
	network_level_id: v.optional(v.number()),
	owner_id: v.optional(v.number()),
	constructor_id: v.optional(v.number()),
	manufacturer_id: v.optional(v.number()),
	flag_id: v.optional(v.number())
};

const CreateConduitSchema = v.object({
	projectId: v.optional(v.number()),
	...ConduitFieldsSchema
});

const UpdateConduitSchema = v.object({
	uuid: UuidSchema,
	...ConduitFieldsSchema
});

const ImportSchema = v.object({ file: v.file() });

/** How many `getConduitList` instances a write may refresh in one flight. */
const LIST_REFRESH_LIMIT = 3;

/**
 * Fetch one page of a project's conduits, optionally filtered by a search term.
 * @param input.projectId - Project to list conduits for.
 * @param input.search - Free-text search (empty for none).
 * @param input.page - 1-based page number.
 * @param input.pageSize - Rows per page.
 * @returns Table rows and the pagination envelope.
 * @throws When the backend request fails.
 */
export const getConduitList = query(
	ConduitListSchema,
	async ({ projectId, search, page, pageSize }): Promise<ConduitListPage> => {
		const headers = djangoHeaders();
		const url = new URL(`${API_URL}conduit/all/`);
		url.searchParams.set('project', projectId);
		if (search) url.searchParams.set('search', search);
		url.searchParams.set('page', String(page));
		url.searchParams.set('page_size', String(pageSize));

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to fetch conduits');

		return mapConduitListPage(await response.json());
	}
);

/**
 * Fetch a single conduit with its expanded references.
 * @param uuid - Conduit UUID.
 * @returns The conduit with its expanded foreign-key references.
 * @throws When the backend request fails.
 */
export const getConduit = query(UuidSchema, async (uuid): Promise<ConduitRecord> => {
	const response = await fetch(`${API_URL}conduit/${encodeURIComponent(uuid)}/`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch conduit');

	return (await response.json()) as ConduitRecord;
});

/**
 * Create a conduit and refresh the list instances the caller requested via
 * `.updates(getConduitList)`. A name clash is reported as a 409 so the
 * caller can show its duplicate message.
 * @param input.projectId - Project the conduit belongs to.
 * @returns The created conduit.
 * @throws When the backend rejects the create.
 */
export const createConduit = command(
	CreateConduitSchema,
	async ({ projectId, ...fields }): Promise<ConduitRecord> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}conduit/`, {
			method: 'POST',
			headers,
			body: JSON.stringify(buildConduitCreateBody(projectId, fields))
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const status = isDuplicateConduitError(response.status, errorData)
				? 409
				: errorStatus(response);
			error(status, backendErrorMessage(errorData, 'Failed to create conduit'));
		}

		await requested(getConduitList, LIST_REFRESH_LIMIT).refreshAll();
		return (await response.json()) as ConduitRecord;
	}
);

/**
 * PATCH a conduit's editable fields, push the result into `getConduit` and
 * refresh the requested list instances.
 * @param input.uuid - Conduit UUID.
 * @returns The updated conduit.
 * @throws When the backend rejects the update.
 */
export const updateConduit = command(
	UpdateConduitSchema,
	async ({ uuid, ...fields }): Promise<ConduitRecord> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}conduit/${encodeURIComponent(uuid)}/`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify(buildConduitPatch(fields))
		});
		if (!response.ok) await failFromResponse(response, 'Failed to update conduit');

		const updated = (await response.json()) as ConduitRecord;
		getConduit(uuid).set(updated);
		await requested(getConduitList, LIST_REFRESH_LIMIT).refreshAll();
		return updated;
	}
);

/**
 * Delete a conduit and refresh the requested list instances.
 * @param uuid - Conduit UUID.
 * @returns Nothing; resolves once the delete and list refresh complete.
 * @throws When the backend rejects the delete.
 */
export const deleteConduit = command(UuidSchema, async (uuid) => {
	const response = await fetch(`${API_URL}conduit/${encodeURIComponent(uuid)}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to delete conduit');

	await requested(getConduitList, LIST_REFRESH_LIMIT).refreshAll();
});

/**
 * Import conduits from an uploaded Excel (.xlsx) file. Format and size
 * problems become form-level issues; backend rejections surface as an
 * `HttpError` carrying the row errors.
 * @param input.file - The uploaded workbook.
 * @returns The backend's import summary.
 */
export const importConduits = form(ImportSchema, async ({ file }): Promise<ConduitImportResult> => {
	const headers = djangoHeaders();
	const issue = importFileIssue(file);
	if (issue) invalid(issue);

	const body = new FormData();
	body.append('file', file);
	const response = await fetch(`${API_URL}import/conduit/`, { method: 'POST', headers, body });
	const result = await response.json().catch(() => ({}));
	if (!response.ok) error(errorStatus(response), importErrorMessage(result));

	await requested(getConduitList, LIST_REFRESH_LIMIT).refreshAll();
	return mapImportResult(result);
});
