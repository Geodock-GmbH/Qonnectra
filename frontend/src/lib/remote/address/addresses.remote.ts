import type { AddressLinks, AddressListPage, AddressRecord } from './address-data';
import type { GeoJsonFeature } from '$lib/types/geo';
import type { FiberConnection } from '$lib/utils/addressPdf';
import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { failFromResponse } from '$lib/remote/shared/backend-error';
import { djangoHeaders } from '$lib/remote/shared/remote-auth';

import {
	buildAddressPatch,
	mapAddressListPage,
	mapLinkedMicroducts,
	mapLinkedNodes,
	normalizeAddress
} from './address-data';

const UuidSchema = v.pipe(v.string(), v.nonEmpty());

const AddressListSchema = v.object({
	projectId: v.pipe(v.string(), v.nonEmpty()),
	search: v.optional(v.string(), ''),
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 50)
});

const UpdateAddressSchema = v.object({
	uuid: UuidSchema,
	street: v.optional(v.string()),
	housenumber: v.optional(v.nullable(v.number())),
	house_number_suffix: v.optional(v.string()),
	zip_code: v.optional(v.string()),
	city: v.optional(v.string()),
	district: v.optional(v.string()),
	status_development_id: v.optional(v.nullable(v.number())),
	flag_id: v.optional(v.nullable(v.number())),
	id_address: v.optional(v.string()),
	id_address_2: v.optional(v.nullable(v.string()))
});

/**
 * Fetch one page of a project's addresses, optionally filtered by a search term.
 * @param input.projectId - Project to list addresses for.
 * @param input.search - Free-text search (empty for none).
 * @param input.page - 1-based page number.
 * @param input.pageSize - Rows per page.
 * @returns Table rows and the pagination envelope.
 * @throws When the backend request fails.
 */
export const getAddressList = query(
	AddressListSchema,
	async ({ projectId, search, page, pageSize }): Promise<AddressListPage> => {
		const headers = djangoHeaders();
		const url = new URL(`${API_URL}address/all/`);
		url.searchParams.set('project', projectId);
		if (search) url.searchParams.set('search', search);
		url.searchParams.set('page', String(page));
		url.searchParams.set('page_size', String(pageSize));

		const response = await fetch(url, { headers });
		if (!response.ok) await failFromResponse(response, 'Failed to fetch addresses');

		return mapAddressListPage(await response.json());
	}
);

/**
 * Fetch a single address, flattened from its GeoJSON envelope.
 * @param uuid - Address UUID.
 * @throws When the backend request fails.
 */
export const getAddress = query(UuidSchema, async (uuid): Promise<AddressRecord> => {
	const response = await fetch(`${API_URL}address/${encodeURIComponent(uuid)}/`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch address');

	return normalizeAddress(await response.json());
});

/**
 * Resolve the nodes linked to an address and every microduct ending at them.
 * @param uuid - Address UUID.
 * @throws When a backend request fails.
 */
export const getAddressLinks = query(UuidSchema, async (uuid): Promise<AddressLinks> => {
	const headers = djangoHeaders();
	const nodesResponse = await fetch(`${API_URL}node/?uuid_address=${encodeURIComponent(uuid)}`, {
		headers
	});
	if (!nodesResponse.ok) await failFromResponse(nodesResponse, 'Failed to fetch linked nodes');

	const nodes = mapLinkedNodes(await nodesResponse.json());
	const microductLists = await Promise.all(
		nodes.map(async (node) => {
			const response = await fetch(
				`${API_URL}microduct/all/?uuid_node=${encodeURIComponent(node.uuid)}`,
				{ headers }
			);
			if (!response.ok) await failFromResponse(response, 'Failed to fetch microducts');
			return mapLinkedMicroducts(node, await response.json());
		})
	);

	return { nodes, microducts: microductLists.flat() };
});

/**
 * Fetch the trench geometries (EPSG:3857) connected to an address.
 * @param uuid - Address UUID.
 * @returns GeoJSON LineString features.
 * @throws When the backend request fails.
 */
export const getLinkedTrenches = query(UuidSchema, async (uuid): Promise<GeoJsonFeature[]> => {
	const response = await fetch(`${API_URL}address/${encodeURIComponent(uuid)}/linked-trenches/`, {
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to fetch linked trenches');

	const data = (await response.json()) as { features?: GeoJsonFeature[] };
	return data.features ?? [];
});

/**
 * Fetch the fiber connections of every residential unit of an address.
 * @param uuid - Address UUID.
 * @returns Fiber connections keyed by residential unit UUID.
 * @throws When the backend request fails.
 */
export const getAddressFiberConnections = query(
	UuidSchema,
	async (uuid): Promise<Record<string, FiberConnection[]>> => {
		const response = await fetch(
			`${API_URL}address/${encodeURIComponent(uuid)}/fiber-connections/`,
			{ headers: djangoHeaders() }
		);
		if (!response.ok) await failFromResponse(response, 'Failed to fetch fiber connections');

		return (await response.json()) as Record<string, FiberConnection[]>;
	}
);

/**
 * PATCH an address's editable fields and push the result into `getAddress`.
 * @param input.uuid - Address UUID.
 * @returns The updated address.
 * @throws When the backend rejects the update.
 */
export const updateAddress = command(UpdateAddressSchema, async ({ uuid, ...fields }) => {
	const headers = djangoHeaders(true);
	const response = await fetch(`${API_URL}address/${encodeURIComponent(uuid)}/`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify(buildAddressPatch(fields))
	});
	if (!response.ok) await failFromResponse(response, 'Failed to update address');

	const updated = normalizeAddress(await response.json());
	getAddress(uuid).set(updated);
	return updated;
});

/**
 * Ask the backend for a fresh address id and push the result into `getAddress`.
 * @param uuid - Address UUID.
 * @returns The updated address.
 * @throws When the backend rejects the request.
 */
export const regenerateAddressId = command(UuidSchema, async (uuid) => {
	const headers = djangoHeaders(true);
	const response = await fetch(`${API_URL}address/${encodeURIComponent(uuid)}/regenerate-id/`, {
		method: 'POST',
		headers
	});
	if (!response.ok) await failFromResponse(response, 'Failed to regenerate address ID');

	const updated = normalizeAddress(await response.json());
	getAddress(uuid).set(updated);
	return updated;
});

/**
 * Delete an address. The caller navigates away afterwards.
 * @param uuid - Address UUID.
 * @throws When the backend rejects the delete.
 */
export const deleteAddress = command(UuidSchema, async (uuid) => {
	const response = await fetch(`${API_URL}address/${encodeURIComponent(uuid)}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});
	if (!response.ok) await failFromResponse(response, 'Failed to delete address');
});
