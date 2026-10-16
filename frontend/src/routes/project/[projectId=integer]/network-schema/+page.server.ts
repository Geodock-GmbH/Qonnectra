import type { PageServerLoad } from './$types';
import type { ComboboxItem } from '$lib/types/attributeCardTypes';
import { error } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { mapNodesToOptions } from '$lib/remote/network-schema/node-options';
import { toOptions } from '$lib/remote/shared/attribute-options';
import { discardBodies, readOkJson } from '$lib/remote/shared/json';

type ApiRecord = Record<string, unknown>;

/** The node endpoint's GeoJSON collection with the project's schema settings. */
interface NodeCollection {
	metadata?: {
		settings_configured?: boolean;
		excluded_node_type_ids?: number[];
		child_view_enabled_node_type_ids?: number[];
	};
}

/** What the page receives, on success and in the fallback. */
interface NetworkSchemaPageData {
	nodes: unknown;
	cables: ApiRecord[];
	cableMicropipeConnections: ApiRecord;
	cableTypes: ComboboxItem[];
	nodeTypes: ComboboxItem[];
	statuses: ComboboxItem[];
	networkLevels: ComboboxItem[];
	companies: ComboboxItem[];
	flags: ComboboxItem[];
	networkSchemaSettingsConfigured: boolean;
	excludedNodeTypeIds: number[];
	childViewEnabledNodeTypeIds: number[];
	parentNodeOptions: { value: string; label: string }[];
}

/**
 * Backend paths of the page's parallel requests, keyed by what they load.
 * @param projectId - The project whose schema is loaded.
 * @returns The path of each request relative to `API_URL`.
 */
function endpoints(projectId: string) {
	return {
		nodes: `node/all/?project=${projectId}`,
		cables: `cable/all/?project=${projectId}`,
		cableLabels: `cable_label/all/?project=${projectId}`,
		cableMicropipeConnections: `cables/micropipe-summary/${projectId}/`,
		cableTypes: 'attributes_cable_type/',
		nodeTypes: 'attributes_node_type/',
		statuses: 'attributes_status/',
		networkLevels: 'attributes_network_level/',
		companies: 'attributes_company/',
		flags: 'flags/'
	};
}

type Endpoint = keyof ReturnType<typeof endpoints>;

/**
 * Pairs each endpoint with its entry of the parallel batch.
 * @param keys - The endpoints in request order.
 * @param values - One value per endpoint, in the same order.
 * @returns The values keyed by endpoint.
 */
function byEndpoint<V>(keys: Endpoint[], values: V[]): Record<Endpoint, V> {
	return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as Record<Endpoint, V>;
}

/**
 * Returns the body of a request the page can do without, or `fallback` when it failed.
 * @param body - The parsed body, `undefined` when the request failed.
 * @param endpoint - The endpoint, named in the warning.
 * @param fallback - The value the page continues with.
 * @returns The body, or `fallback`.
 */
function optionalBody<T>(body: unknown, endpoint: Endpoint, fallback: T): T {
	if (body != null) return body as T;
	console.warn(`Failed to fetch ${endpoint}, continuing without it`);
	return fallback;
}

/**
 * Loads network schema page data including nodes, cables and attribute options.
 * Canvas positions are set by the database when a node is created, so nodes arrive placed.
 * All bodies are read at once: a body left waiting while another one parses holds its
 * connection open until Django closes it.
 * @param event - Load event; `params.projectId` selects the project whose schema is loaded.
 * @returns The schema data, or empty collections when a request other than the node fetch fails.
 */
export const load: PageServerLoad = async ({
	fetch,
	cookies,
	params
}): Promise<NetworkSchemaPageData> => {
	const headers = getAuthHeaders(cookies);
	const paths = endpoints(params.projectId);
	const keys = Object.keys(paths) as Endpoint[];

	try {
		const responses = await Promise.all(
			keys.map((key) => fetch(`${API_URL}${paths[key]}`, { credentials: 'include', headers }))
		);
		const nodeResponse = byEndpoint(keys, responses).nodes;

		if (!nodeResponse.ok) {
			await discardBodies(responses.filter((response) => response !== nodeResponse));
			throw error(500, 'Failed to fetch nodes');
		}

		const body = byEndpoint(keys, await Promise.all(responses.map(readOkJson)));
		const nodesData = body.nodes;
		const metadata = (nodesData as NodeCollection | null)?.metadata;
		const cableLabelsData = optionalBody<ApiRecord[]>(body.cableLabels, 'cableLabels', []);

		const cableLabelMap: Record<string, unknown[]> = {};
		cableLabelsData.forEach((label: ApiRecord) => {
			const cableUuid = (label.cable as ApiRecord)?.uuid || label.cable;
			if (!cableLabelMap[cableUuid as string]) {
				cableLabelMap[cableUuid as string] = [];
			}
			cableLabelMap[cableUuid as string].push(label);
		});

		const cablesData = optionalBody<ApiRecord[]>(body.cables, 'cables', []).map(
			(cable: ApiRecord) => {
				const cableUuid = cable.uuid || (cable.cable as ApiRecord)?.uuid || cable.cable;
				return {
					...cable,
					uuid: cableUuid,
					labelData: cableLabelMap[cableUuid as string]?.[0] || null
				};
			}
		);

		const options = (endpoint: Endpoint, labelKey: string) =>
			toOptions(optionalBody<ApiRecord[]>(body[endpoint], endpoint, []), labelKey);

		return {
			nodes: nodesData,
			cables: cablesData,
			cableMicropipeConnections: optionalBody<ApiRecord>(
				body.cableMicropipeConnections,
				'cableMicropipeConnections',
				{}
			),
			cableTypes: options('cableTypes', 'cable_type'),
			nodeTypes: options('nodeTypes', 'node_type'),
			statuses: options('statuses', 'status'),
			networkLevels: options('networkLevels', 'network_level'),
			companies: options('companies', 'company'),
			flags: options('flags', 'flag'),
			networkSchemaSettingsConfigured: metadata?.settings_configured ?? false,
			excludedNodeTypeIds: metadata?.excluded_node_type_ids ?? [],
			childViewEnabledNodeTypeIds: metadata?.child_view_enabled_node_type_ids ?? [],
			parentNodeOptions: mapNodesToOptions(nodesData)
		};
	} catch (err) {
		const typedErr = err as { status?: number; message?: string };
		if (typedErr.status === 500 && typedErr.message === 'Failed to fetch nodes') {
			throw err;
		}

		console.error('Error loading network schema page:', err);
		return {
			nodes: [],
			cables: [],
			cableMicropipeConnections: {},
			cableTypes: [],
			nodeTypes: [],
			statuses: [],
			networkLevels: [],
			companies: [],
			flags: [],
			networkSchemaSettingsConfigured: false,
			excludedNodeTypeIds: [],
			childViewEnabledNodeTypeIds: [],
			parentNodeOptions: []
		};
	}
};
