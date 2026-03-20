import { redirect } from '@sveltejs/kit';
import { API_URL } from '$env/static/private';

import { getAuthHeaders } from '$lib/utils/getAuthHeaders';
import { mapNodesToOptions } from '$lib/server/nodeData';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies, params }) {
	const headers = getAuthHeaders(cookies);
	const projectId = params.projectId;
	const nodeId = params.nodeId;

	if (!projectId || !nodeId) {
		throw redirect(302, '/network-schema');
	}

	try {
		const [
			nodeResponse,
			cableResponse,
			cableLabelResponse,
			cableMicropipeResponse,
			cableTypeResponse,
			nodeTypeResponse,
			statusResponse,
			networkLevelResponse,
			companyResponse,
			flagsResponse,
			allNodesResponse
		] = await Promise.all([
			fetch(`${API_URL}node/all/?project=${projectId}&child_view_for=${nodeId}`, {
				credentials: 'include',
				headers
			}),
			fetch(`${API_URL}cable/all/?project=${projectId}&child_view_for=${nodeId}`, {
				credentials: 'include',
				headers
			}),
			fetch(`${API_URL}cable_label/all/?project=${projectId}`, {
				credentials: 'include',
				headers
			}),
			fetch(`${API_URL}cables/micropipe-summary/${projectId}/`, {
				credentials: 'include',
				headers
			}),
			fetch(`${API_URL}attributes_cable_type/`, { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_node_type/`, { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_status/`, { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_network_level/`, { credentials: 'include', headers }),
			fetch(`${API_URL}attributes_company/`, { credentials: 'include', headers }),
			fetch(`${API_URL}flags/`, { credentials: 'include', headers }),
			fetch(`${API_URL}node/all/?project=${projectId}&minimal=true`, {
				credentials: 'include',
				headers
			})
		]);

		if (!nodeResponse.ok) {
			throw redirect(302, `/network-schema/${projectId}`);
		}

		const nodesData = await nodeResponse.json();
		const childViewEnabledNodeTypeIds = nodesData?.metadata?.child_view_enabled_node_type_ids ?? [];

		const nodes = nodesData?.features || nodesData || [];
		const parentNode = nodes.find(
			(/** @type {any} */ n) => (n.id || n.properties?.uuid) === nodeId
		);
		if (!parentNode && nodes.length === 0) {
			throw redirect(302, `/network-schema/${projectId}`);
		}

		let cablesData = [];
		if (cableResponse.ok) {
			cablesData = await cableResponse.json();
		}

		let cableLabelsData = [];
		if (cableLabelResponse.ok) {
			cableLabelsData = await cableLabelResponse.json();
		}

		/** @type {Record<string, any[]>} */
		const cableLabelMap = {};
		cableLabelsData.forEach((/** @type {any} */ label) => {
			const cableUuid = label.cable?.uuid || label.cable;
			if (!cableLabelMap[cableUuid]) {
				cableLabelMap[cableUuid] = [];
			}
			cableLabelMap[cableUuid].push(label);
		});

		cablesData = cablesData.map((/** @type {any} */ cable) => {
			const cableUuid = cable.uuid || (cable.cable && cable.cable.uuid) || cable.cable;
			return {
				...cable,
				uuid: cableUuid,
				labelData: cableLabelMap[cableUuid]?.[0] || null
			};
		});

		let cableMicropipeConnections = {};
		if (cableMicropipeResponse.ok) {
			cableMicropipeConnections = await cableMicropipeResponse.json();
		}

		let cableTypesData = [];
		let nodeTypesData = [];
		let statusData = [];
		let networkLevelData = [];
		let companyData = [];
		let flagsData = [];

		if (cableTypeResponse.ok) {
			cableTypesData = (await cableTypeResponse.json()).map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.cable_type
			}));
		}

		if (nodeTypeResponse.ok) {
			nodeTypesData = (await nodeTypeResponse.json()).map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.node_type
			}));
		}

		if (statusResponse.ok) {
			statusData = (await statusResponse.json()).map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.status
			}));
		}

		if (networkLevelResponse.ok) {
			networkLevelData = (await networkLevelResponse.json()).map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.network_level
			}));
		}

		if (companyResponse.ok) {
			companyData = (await companyResponse.json()).map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.company
			}));
		}

		if (flagsResponse.ok) {
			flagsData = (await flagsResponse.json()).map((/** @type {any} */ item) => ({
				value: item.id,
				label: item.flag
			}));
		}

		/** @type {{ value: string, label: string }[]} */
		let parentNodeOptions = [];
		if (allNodesResponse.ok) {
			parentNodeOptions = mapNodesToOptions(await allNodesResponse.json());
		}

		return {
			nodes: nodesData,
			cables: cablesData,
			cableMicropipeConnections,
			cableTypes: cableTypesData,
			nodeTypes: nodeTypesData,
			statuses: statusData,
			networkLevels: networkLevelData,
			companies: companyData,
			flags: flagsData,
			syncStatus: null,
			networkSchemaSettingsConfigured: true,
			excludedNodeTypeIds: [],
			childViewEnabledNodeTypeIds,
			parentNodeId: nodeId,
			isChildView: true,
			parentNodeOptions
		};
	} catch (err) {
		if (/** @type {any} */ (err).status === 302) throw err;
		console.error('Error loading child network view:', err);
		throw redirect(302, `/network-schema/${projectId}`);
	}
}

// Re-export actions from parent for drawer functionality
export { actions } from '../../+page.server.js';
