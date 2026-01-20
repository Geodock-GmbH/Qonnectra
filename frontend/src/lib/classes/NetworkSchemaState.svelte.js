import { page } from '$app/state';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';

/**
 * Main state manager for the network schema diagram
 * Manages nodes, edges, cable types, and diagram interactions
 */
export class NetworkSchemaState {
	nodes = $state.raw([]);
	edges = $state.raw([]);
	cableTypes = $state([]);
	userCableName = $state('');
	selectedCableType = $state([]);

	constructor(initialData) {
		this.nodes = this.transformNodesToSvelteFlow(initialData.nodes);
		this.edges = this.transformCablesToSvelteFlowEdges(initialData.cables);
		this.cableTypes = initialData.cableTypes;
	}

	/**
	 * Transform Node data to SvelteFlow nodes using backend canvas coordinates
	 * @param {Object|Array} nodeData - GeoJSON FeatureCollection or array of Node objects from the API
	 * @returns {Array} SvelteFlow compatible nodes
	 */
	transformNodesToSvelteFlow(nodeData) {
		const nodes = nodeData?.features || nodeData || [];
		if (!nodes || nodes.length === 0) {
			return [];
		}

		return nodes.map((nodeOrFeature) => {
			const node = nodeOrFeature.properties || nodeOrFeature;
			let x = node.canvas_x;
			let y = node.canvas_y;

			if (x === null || y === null || x === undefined || y === undefined) {
				const geometry = nodeOrFeature.geometry || node.geometry;
				const [geoX, geoY] = geometry?.coordinates || [0, 0];
				x = geoX * 0.0001;
				y = -geoY * 0.0001;
			}

			return {
				id: nodeOrFeature.id || node.uuid,
				position: { x, y },
				type: 'cableDiagramNode',
				selected: false,
				data: {
					label: node.name || 'Unnamed Node',
					node: node,
					onNodeSelect: (nodeId) => this.selectNode(nodeId)
				}
			};
		});
	}

	/**
	 * Transform Cable data to SvelteFlow edges
	 * @param {Array} cablesData - Array of Cable objects from the API
	 * @returns {Array} SvelteFlow compatible edges
	 */
	transformCablesToSvelteFlowEdges(cablesData) {
		const cables = Array.isArray(cablesData) ? cablesData : [];

		if (cables.length === 0) {
			return [];
		}

		const edges = cables
			.filter((cable) => cable.uuid_node_start && cable.uuid_node_end)
			.map((cable) => ({
				id: cable.uuid,
				source: cable.uuid_node_start,
				target: cable.uuid_node_end,
				sourceHandle: cable.handle_start
					? `${cable.uuid_node_start}-${cable.handle_start}-source`
					: undefined,
				targetHandle: cable.handle_end
					? `${cable.uuid_node_end}-${cable.handle_end}-target`
					: undefined,
				type: 'cableDiagramEdge',
				data: {
					label: cable.labelData?.text || cable.name,
					cable: cable,
					labelData: cable.labelData,
					onEdgeDelete: (edgeId) => this.handleEdgeDelete(edgeId),
					onEdgeSelect: (edgeId) => this.selectEdge(edgeId)
				}
			}));

		return edges;
	}

	/**
	 * Handle edge deletion - removes edge from the local state
	 * @param {string} edgeId - The UUID of the edge/cable to remove
	 */
	handleEdgeDelete(edgeId) {
		this.edges = this.edges.filter((edge) => edge.id !== edgeId);
	}

	/**
	 * Select a specific node and deselect all others
	 * @param {string} nodeId - The node UUID to select
	 */
	selectNode(nodeId) {
		this.nodes = this.nodes.map((n) => ({
			...n,
			selected: n.id === nodeId
		}));
	}

	/**
	 * Deselect all nodes
	 */
	deselectAllNodes() {
		this.nodes = this.nodes.map((n) => ({
			...n,
			selected: false
		}));
	}

	/**
	 * Select a single edge (cable) by ID
	 * @param {string} edgeId - The edge ID to select
	 */
	selectEdge(edgeId) {
		this.edges = this.edges.map((e) => ({
			...e,
			selected: e.id === edgeId
		}));
	}

	/**
	 * Deselect all edges
	 */
	deselectAllEdges() {
		this.edges = this.edges.map((e) => ({
			...e,
			selected: false
		}));
	}

	/**
	 * Handle node drag stop - saves position via form action
	 * @param {Object} event - Event object from SvelteFlow
	 */
	async handleNodeDragStop(event) {
		const node = event.targetNode;
		const nodeId = node.id;
		const newPosition = node.position;

		const originalNode = this.nodes.find((n) => n.id === nodeId);
		const originalPosition = { ...originalNode.position };

		try {
			const formData = new FormData();
			formData.append('nodeId', nodeId);
			formData.append('canvas_x', newPosition.x.toString());
			formData.append('canvas_y', newPosition.y.toString());

			const response = await fetch('?/saveNodeGeometry', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok || result.type === 'error') {
				throw new Error(result.message || 'Failed to save node position');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_position()
			});
		} catch (error) {
			console.error('Error saving node position:', error);

			const nodeIndex = this.nodes.findIndex((n) => n.id === nodeId);
			if (nodeIndex !== -1) {
				this.nodes[nodeIndex] = {
					...this.nodes[nodeIndex],
					position: originalPosition
				};
			}

			globalToaster.error({
				title: m.common_error(),
				description: `${error.message}`
			});
		}
	}

	/**
	 * Generate random string for cable names
	 * @param {number} length - The length of the random string
	 * @returns {string} The random string
	 */
	generateRandomString(length = 10) {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const array = new Uint32Array(length);
		crypto.getRandomValues(array);
		return Array.from(array, (x) => chars[x % chars.length]).join('');
	}

	/**
	 * Parse handle ID to extract position
	 * @param {string} handleId - Handle ID format: {nodeUuid}-{position}-{type}
	 * @returns {string} 'top', 'right', 'bottom', or 'left'
	 */
	parseHandlePosition(handleId) {
		if (!handleId) return null;
		const parts = handleId.split('-');
		return parts[parts.length - 2];
	}

	/**
	 * Handle new edge connection - creates a Cable record via form action
	 * @param {Object} connection - Connection object from SvelteFlow
	 * @param {string} selectedProject - Current project ID
	 */
	async handleConnect(connection, selectedProject) {
		const { source, target, sourceHandle, targetHandle } = connection;

		const handleStart = this.parseHandlePosition(sourceHandle);
		const handleEnd = this.parseHandlePosition(targetHandle);

		const trimmedName = this.userCableName.trim();
		const cableName =
			trimmedName.length === 0
				? this.generateRandomString()
				: `${trimmedName}-${this.generateRandomString()}`;

		if (this.selectedCableType.length === 0) {
			await logToBackendClient({
				level: 'ERROR',
				message: 'No cable type selected when attempting to create cable',
				path: page.url.pathname,
				extraData: {
					source,
					target,
					cableName,
					from: 'handleConnect'
				},
				project: selectedProject
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_no_cable_type_selected()
			});
			return;
		}

		const cableUuid = crypto.randomUUID();

		try {
			const formData = new FormData();
			formData.append('uuid', cableUuid);
			formData.append('name', cableName);
			formData.append('cable_type_id', this.selectedCableType?.[0]);
			formData.append('project_id', selectedProject);
			formData.append('flag_id', '1');
			formData.append('uuid_node_start_id', target);
			formData.append('uuid_node_end_id', source);
			if (handleStart) formData.append('handle_start', handleEnd);
			if (handleEnd) formData.append('handle_end', handleStart);

			const response = await fetch('?/createCable', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok || result.type === 'error') {
				throw new Error(result.error || 'Failed to create cable');
			}

			const cableData = result.data;

			if (cableData.uuid !== cableUuid) {
				console.warn(
					`UUID mismatch: sent ${cableUuid}, received ${cableData.uuid}. Using received UUID.`
				);
			}

			this.edges = [
				...this.edges,
				{
					id: cableUuid,
					source: target,
					target: source,
					sourceHandle: handleEnd ? `${target}-${handleEnd}-source` : undefined,
					targetHandle: handleStart ? `${source}-${handleStart}-target` : undefined,
					type: 'cableDiagramEdge',
					data: {
						label: cableName,
						cable: { ...cableData, uuid: cableUuid },
						onEdgeDelete: (edgeId) => this.handleEdgeDelete(edgeId)
					}
				}
			];

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_cable()
			});
		} catch (error) {
			console.error('Error creating cable:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_cable()
			});
		}
	}

	/**
	 * Update edge data in local state
	 * @param {string} edgeId - Edge UUID
	 * @param {Object} updates - Updates to apply to edge data
	 */
	updateEdge(edgeId, updates) {
		this.edges = this.edges.map((edge) => {
			if (edge.id === edgeId) {
				return {
					...edge,
					...updates
				};
			}
			return edge;
		});
	}

	/**
	 * Update cable handles for an edge
	 * @param {string} cableId - Cable UUID
	 * @param {string} handleStart - Start handle position
	 * @param {string} handleEnd - End handle position
	 */
	updateCableHandles(cableId, handleStart, handleEnd) {
		const edge = this.edges.find((e) => e.id === cableId);
		if (!edge) {
			console.error(`Edge not found for cable ID: ${cableId}`);
			return;
		}

		this.edges = this.edges.map((e) => {
			if (e.id === cableId) {
				return {
					...e,
					sourceHandle: handleStart ? `${edge.source}-${handleStart}-source` : undefined,
					targetHandle: handleEnd ? `${edge.target}-${handleEnd}-target` : undefined,
					data: {
						...e.data,
						cable: {
							...e.data.cable,
							handle_start: handleStart,
							handle_end: handleEnd
						}
					}
				};
			}
			return e;
		});
	}
}
