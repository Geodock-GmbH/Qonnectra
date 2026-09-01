import { command, query } from '$app/server';
import { API_URL } from '$env/static/private';
import * as v from 'valibot';

import { fetchNodeDependencies } from './node-dependencies';
import { djangoHeaders } from './remote-auth';

const SaveNodeGeometrySchema = v.object({
	nodeId: v.pipe(v.string(), v.nonEmpty()),
	x: v.number(),
	y: v.number(),
	// When true the coordinates target the node's position inside a parent's
	// child view (`child_canvas_x/y`) rather than the top-level canvas.
	isChildView: v.optional(v.boolean(), false)
});

const NodeDependenciesSchema = v.object({
	nodeId: v.pipe(v.string(), v.nonEmpty()),
	projectId: v.optional(v.string())
});

const UpdateNodeSchema = v.object({
	nodeId: v.pipe(v.string(), v.nonEmpty()),
	name: v.optional(v.string()),
	nodeTypeId: v.optional(v.number()),
	statusId: v.optional(v.number()),
	networkLevelId: v.optional(v.number()),
	ownerId: v.optional(v.number()),
	constructorId: v.optional(v.number()),
	manufacturerId: v.optional(v.number()),
	flagId: v.optional(v.number()),
	warranty: v.optional(v.string()),
	date: v.optional(v.string()),
	parentNodeId: v.optional(v.string())
});

/**
 * Fetch a node's full detail record for the node-details drawer.
 * @param uuid - Node UUID.
 * @returns The node detail object from the backend.
 * @throws When the backend request fails.
 */
export const getNodeDetails = query(v.pipe(v.string(), v.nonEmpty()), async (uuid) => {
	const response = await fetch(`${API_URL}node/${uuid}`, {
		method: 'GET',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: Failed to load node details`);
	}

	return (await response.json()) as Record<string, unknown>;
});

/**
 * Persist a node's canvas position after a drag.
 * @param input.nodeId - Node UUID.
 * @param input.x - New x coordinate.
 * @param input.y - New y coordinate.
 * @param input.isChildView - When true, writes the child-view coordinates.
 * @returns The updated node record from the backend.
 * @throws When the backend rejects the update.
 */
export const saveNodeGeometry = command(
	SaveNodeGeometrySchema,
	async ({ nodeId, x, y, isChildView }) => {
		const headers = djangoHeaders(true);

		const updatePayload = isChildView
			? { child_canvas_x: x, child_canvas_y: y }
			: { canvas_x: x, canvas_y: y };

		const response = await fetch(`${API_URL}node/${nodeId}/`, {
			method: 'PATCH',
			headers,
			body: JSON.stringify(updatePayload)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.detail || `HTTP ${response.status}: Failed to update node position`
			);
		}

		return (await response.json()) as Record<string, unknown>;
	}
);

/**
 * Resolve a node's deletion dependencies (cables, structures, child nodes).
 * @param input.nodeId - Node UUID to inspect.
 * @param input.projectId - Project id; children are only resolved when present.
 * @returns The dependency summary used to gate deletion and lock fields.
 * @throws When a backend request fails.
 */
export const getNodeDependencies = query(NodeDependenciesSchema, async ({ nodeId, projectId }) => {
	return fetchNodeDependencies(fetch, djangoHeaders(), API_URL, nodeId, projectId);
});

/**
 * Update a node's attributes. Only provided fields are sent; `parentNodeId` is
 * always written (an empty value clears the parent).
 * @param input.nodeId - Node UUID to update.
 * @returns The updated node record.
 * @throws When the backend rejects the update.
 */
export const updateNode = command(UpdateNodeSchema, async (input) => {
	const headers = djangoHeaders(true);

	const requestBody: Record<string, unknown> = {};
	if (input.name) requestBody.name = input.name;
	if (input.nodeTypeId != null) requestBody.node_type_id = input.nodeTypeId;
	if (input.statusId != null) requestBody.status_id = input.statusId;
	if (input.networkLevelId != null) requestBody.network_level_id = input.networkLevelId;
	if (input.ownerId != null) requestBody.owner_id = input.ownerId;
	if (input.constructorId != null) requestBody.constructor_id = input.constructorId;
	if (input.manufacturerId != null) requestBody.manufacturer_id = input.manufacturerId;
	if (input.flagId != null) requestBody.flag_id = input.flagId;
	if (input.date) requestBody.date = input.date;
	if (input.warranty) requestBody.warranty = input.warranty;
	requestBody.parent_node_id = input.parentNodeId || null;

	const response = await fetch(`${API_URL}node/${input.nodeId}/`, {
		method: 'PATCH',
		headers,
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to update node`);
	}

	return (await response.json()) as Record<string, unknown>;
});

/**
 * Delete a node.
 * @param nodeId - Node UUID to delete.
 * @throws When the backend rejects the delete.
 */
export const deleteNode = command(v.pipe(v.string(), v.nonEmpty()), async (nodeId) => {
	const response = await fetch(`${API_URL}node/${nodeId}/`, {
		method: 'DELETE',
		headers: djangoHeaders()
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.detail || `HTTP ${response.status}: Failed to delete node`);
	}
});
