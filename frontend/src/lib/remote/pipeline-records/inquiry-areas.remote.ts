import type { InquiryArea } from './inquiry-area-data';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import {
	buildAreaCreateBody,
	buildAreaGeometryPatch,
	buildAreaRenamePatch,
	mapInquiryAreas
} from './inquiry-area-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const PolygonSchema = v.object({
	type: v.literal('Polygon'),
	coordinates: v.array(v.array(v.array(v.number())))
});

const CreateAreaSchema = v.object({
	recordUuid: UuidSchema,
	geometry: PolygonSchema
});

const UpdateAreaGeometrySchema = v.object({
	recordUuid: UuidSchema,
	areaUuid: UuidSchema,
	geometry: PolygonSchema
});

const RenameAreaSchema = v.object({
	recordUuid: UuidSchema,
	areaUuid: UuidSchema,
	name: v.pipe(v.string(), v.trim(), v.nonEmpty())
});

const DeleteAreaSchema = v.object({
	recordUuid: UuidSchema,
	areaUuid: UuidSchema
});

/**
 * Fetch the inquiry areas drawn for a pipeline record.
 * @param recordUuid - Pipeline record UUID.
 * @returns The record's inquiry areas, geometries in the storage projection.
 * @throws When the backend request fails.
 */
export const getInquiryAreas = query(UuidSchema, async (recordUuid): Promise<InquiryArea[]> => {
	const response = await fetch(
		`${API_URL}pipeline-inquiry-areas/?pipeline_record=${encodeURIComponent(recordUuid)}`,
		{ headers: djangoHeaders() }
	);
	if (!response.ok) await failFromResponse(response, 'Failed to fetch inquiry areas');

	return mapInquiryAreas(await response.json());
});

/**
 * Save a drawn polygon as an inquiry area and refresh the record's areas in
 * the same flight.
 * @param input.recordUuid - Pipeline record UUID, whose `getInquiryAreas` instance is refreshed.
 * @param input.geometry - The drawn polygon in EPSG:4326.
 * @throws When the backend rejects the polygon.
 */
export const createInquiryArea = command(
	CreateAreaSchema,
	async ({ recordUuid, geometry }): Promise<void> => {
		const headers = djangoHeaders(true);
		const response = await fetch(`${API_URL}pipeline-inquiry-areas/`, {
			method: 'POST',
			headers,
			body: JSON.stringify(buildAreaCreateBody(recordUuid, geometry))
		});
		if (!response.ok) await failFromResponse(response, 'Failed to save polygon');

		await getInquiryAreas(recordUuid).refresh();
	}
);

/**
 * Replace an inquiry area's geometry and refresh the record's areas in the
 * same flight.
 * @param input.recordUuid - Pipeline record UUID, whose `getInquiryAreas` instance is refreshed.
 * @param input.areaUuid - Inquiry area UUID.
 * @param input.geometry - The modified polygon in EPSG:4326.
 * @throws When the backend rejects the polygon.
 */
export const updateInquiryAreaGeometry = command(
	UpdateAreaGeometrySchema,
	async ({ recordUuid, areaUuid, geometry }): Promise<void> => {
		const headers = djangoHeaders(true);
		const response = await fetch(
			`${API_URL}pipeline-inquiry-areas/${encodeURIComponent(areaUuid)}/`,
			{ method: 'PATCH', headers, body: JSON.stringify(buildAreaGeometryPatch(geometry)) }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to update polygon');

		await getInquiryAreas(recordUuid).refresh();
	}
);

/**
 * Rename an inquiry area and refresh the record's areas in the same flight.
 * @param input.recordUuid - Pipeline record UUID, whose `getInquiryAreas` instance is refreshed.
 * @param input.areaUuid - Inquiry area UUID.
 * @param input.name - The new name; surrounding whitespace is dropped.
 * @throws When the backend rejects the name.
 */
export const renameInquiryArea = command(
	RenameAreaSchema,
	async ({ recordUuid, areaUuid, name }): Promise<void> => {
		const headers = djangoHeaders(true);
		const response = await fetch(
			`${API_URL}pipeline-inquiry-areas/${encodeURIComponent(areaUuid)}/`,
			{ method: 'PATCH', headers, body: JSON.stringify(buildAreaRenamePatch(name)) }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to rename polygon');

		await getInquiryAreas(recordUuid).refresh();
	}
);

/**
 * Delete an inquiry area and refresh the record's areas in the same flight.
 * @param input.recordUuid - Pipeline record UUID, whose `getInquiryAreas` instance is refreshed.
 * @param input.areaUuid - Inquiry area UUID.
 * @throws When the backend rejects the delete.
 */
export const deleteInquiryArea = command(
	DeleteAreaSchema,
	async ({ recordUuid, areaUuid }): Promise<void> => {
		const headers = djangoHeaders();
		const response = await fetch(
			`${API_URL}pipeline-inquiry-areas/${encodeURIComponent(areaUuid)}/`,
			{ method: 'DELETE', headers }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to delete polygon');

		await getInquiryAreas(recordUuid).refresh();
	}
);
