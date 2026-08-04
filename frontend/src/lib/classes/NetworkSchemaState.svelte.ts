import type { ActionResult } from '@sveltejs/kit';
import { deserialize } from '$app/forms';
import { page } from '$app/state';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';

export interface NodeProperties {
	uuid: string;
	name: string;
	canvas_x: number | null;
	canvas_y: number | null;
	child_canvas_x: number | null;
	child_canvas_y: number | null;
	geometry?: { coordinates: [number, number] };
}

export interface NodeFeature {
	id: string;
	properties?: NodeProperties;
	geometry?: { coordinates: [number, number] };
	uuid?: string;
	name?: string;
	canvas_x?: number | null;
	canvas_y?: number | null;
	child_canvas_x?: number | null;
	child_canvas_y?: number | null;
}

export interface NodeFeatureCollection {
	features?: NodeFeature[];
}

export interface EdgeLabelData {
	position_x: number;
	position_y: number;
	text: string;
	uuid: string;
}

export interface CableData {
	uuid: string;
	name: string;
	uuid_node_start: string;
	uuid_node_end: string;
	handle_start?: string;
	handle_end?: string;
	labelData?: EdgeLabelData | null;
	warning?: string;
}

export interface MicropipeConnection {
	uuid: string;
	number: number;
	color?: string;
}

export type MicropipeConnectionMap = Record<string, MicropipeConnection[]>;

export interface SvelteFlowNode {
	id: string;
	position: { x: number; y: number };
	type: string;
	selected: boolean;
	data: {
		label: string;
		node: NodeProperties | NodeFeature;
		onNodeSelect: (nodeId: string) => void;
		onNodeDelete: (nodeId: string) => void;
		onNameUpdate: (newName: string) => void;
	};
}

export interface SvelteFlowEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
	type: string;
	selected?: boolean;
	data: {
		label: string;
		cable: CableData;
		labelData?: EdgeLabelData | null;
		micropipeConnections?: MicropipeConnection[];
		lowestMicropipe?: MicropipeConnection | null;
		isConnected?: boolean;
		onEdgeDelete: (edgeId: string) => void;
		onEdgeSelect: (edgeId: string) => void;
		onNameUpdate: (newName: string) => void;
	};
}

export interface CableType {
	id: string;
	name: string;
}

export interface NetworkSchemaInitData {
	nodes: NodeFeatureCollection | NodeFeature[];
	cables: CableData[];
	cableMicropipeConnections: MicropipeConnectionMap;
	cableTypes: CableType[];
}

export interface SvelteFlowConnection {
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
}

export interface NodeDragStopEvent {
	targetNode: { id: string; position: { x: number; y: number } };
}

export interface MicroductCandidate {
	microduct_uuid: string;
	number: number;
	color: string;
	color_hex: string;
	conduit_uuid: string;
	conduit_name: string;
	node_name: string | null;
	linked_cables: { uuid: string; name: string }[];
}

export interface PendingMicroductChoice {
	cableId: string;
	cableName: string;
	end: string;
	nodeName: string | null;
	address: string | null;
	candidates: MicroductCandidate[];
}

interface AutoLinkEndResult {
	status: 'linked' | 'multiple_candidates' | string;
	microduct?: MicroductCandidate;
	end?: string;
	node_name?: string | null;
	address?: string | null;
	candidates?: MicroductCandidate[];
}

interface AutoLinkResponse {
	results?: AutoLinkEndResult[];
	linked_count?: number;
	microduct?: MicroductCandidate;
}

/**
 * Main state manager for the network schema diagram.
 * Manages nodes, edges, cable types, and diagram interactions.
 */
export class NetworkSchemaState {
	nodes: SvelteFlowNode[] = $state.raw([]);
	edges: SvelteFlowEdge[] = $state.raw([]);
	cableTypes: CableType[] = $state([]);
	userCableName: string = $state('');
	selectedCableType: string[] = $state([]);

	/** Parent node context for child view cables */
	parentNodeContext: string | null = $state(null);

	/** Queue of unresolved microduct choices for the user */
	pendingMicroductChoices: PendingMicroductChoice[] = $state([]);

	/** Whether currently in child view mode */
	isChildView: boolean = $state(false);

	/** Track if already initialized to prevent duplicate initialization */
	#initialized: boolean = $state(false);

	constructor(initialData: NetworkSchemaInitData | null = null) {
		if (initialData) {
			this.initialize(initialData);
		}
	}

	/**
	 * Check if the state has been initialized
	 */
	get initialized(): boolean {
		return this.#initialized;
	}

	/**
	 * Initialize or re-initialize the state with data
	 * @param data - The page data containing nodes, cables, cableMicropipeConnections, and cableTypes
	 */
	initialize(data: NetworkSchemaInitData): void {
		if (!data || this.#initialized) return;
		this.nodes = this.transformNodesToSvelteFlow(data.nodes);
		this.edges = this.transformCablesToSvelteFlowEdges(data.cables, data.cableMicropipeConnections);
		this.cableTypes = data.cableTypes;
		this.#initialized = true;
	}

	/**
	 * Transform Node data to SvelteFlow nodes using backend canvas coordinates
	 * @param nodeData - GeoJSON FeatureCollection or array of Node objects from the API
	 */
	transformNodesToSvelteFlow(nodeData: NodeFeatureCollection | NodeFeature[]): SvelteFlowNode[] {
		const nodes: NodeFeature[] = Array.isArray(nodeData)
			? nodeData
			: ((nodeData as NodeFeatureCollection).features ?? []);
		if (!nodes || nodes.length === 0) {
			return [];
		}

		return nodes.map((nodeOrFeature) => {
			const node = nodeOrFeature.properties || nodeOrFeature;

			let x: number | null | undefined;
			let y: number | null | undefined;
			if (this.isChildView) {
				x = node.child_canvas_x;
				y = node.child_canvas_y;
			} else {
				x = node.canvas_x;
				y = node.canvas_y;
			}

			if (x === null || y === null || x === undefined || y === undefined) {
				const geometry = nodeOrFeature.geometry || node.geometry;
				const [geoX, geoY] = geometry?.coordinates || [0, 0];
				x = geoX * 0.0001;
				y = -geoY * 0.0001;
			}

			const nodeId = nodeOrFeature.id || node.uuid || '';

			return {
				id: nodeId,
				position: { x, y },
				type: 'cableDiagramNode',
				selected: false,
				data: {
					label: node.name || m.form_unnamed_node(),
					node: node,
					onNodeSelect: (nId: string) => this.selectNode(nId),
					onNodeDelete: (nId: string) => this.handleNodeDelete(nId),
					onNameUpdate: (newName: string) => this.updateNodeName(nodeId, newName)
				}
			};
		});
	}

	/**
	 * Transform Cable data to SvelteFlow edges
	 * @param cablesData - Array of Cable objects from the API
	 * @param micropipeConnections - Map of cable UUID to micropipe connection data
	 */
	transformCablesToSvelteFlowEdges(
		cablesData: CableData[],
		micropipeConnections: MicropipeConnectionMap = {}
	): SvelteFlowEdge[] {
		const cables = Array.isArray(cablesData) ? cablesData : [];

		if (cables.length === 0) {
			return [];
		}

		const edges = cables
			.filter((cable) => cable.uuid_node_start && cable.uuid_node_end)
			.map((cable) => {
				const connections = micropipeConnections[cable.uuid] || [];
				const sortedConnections = [...connections].sort((a, b) => a.number - b.number);
				const lowestMicropipe = sortedConnections[0] || null;

				return {
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
						micropipeConnections: connections,
						lowestMicropipe: lowestMicropipe,
						isConnected: connections.length > 0,
						onEdgeDelete: (edgeId: string) => this.handleEdgeDelete(edgeId),
						onEdgeSelect: (edgeId: string) => this.selectEdge(edgeId),
						onNameUpdate: (newName: string) => this.updateEdgeName(cable.uuid, newName)
					}
				};
			});

		return edges;
	}

	/**
	 * Handle edge deletion - removes edge from the local state
	 * @param edgeId - The UUID of the edge/cable to remove
	 */
	handleEdgeDelete(edgeId: string): void {
		const edge = this.edges.find((e) => e.id === edgeId);
		const affectedNodeIds = edge ? [edge.source, edge.target] : [];

		this.edges = this.edges.filter((e) => e.id !== edgeId);

		if (affectedNodeIds.length > 0) {
			window.dispatchEvent(
				new CustomEvent('cableConnectionChanged', {
					detail: { nodeIds: affectedNodeIds }
				})
			);
		}
	}

	/**
	 * Handle node deletion - removes node and connected edges from local state
	 * @param nodeId - The UUID of the node to remove
	 */
	handleNodeDelete(nodeId: string): void {
		this.nodes = this.nodes.filter((node) => node.id !== nodeId);
		this.edges = this.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
	}

	/**
	 * Select a specific node and deselect all others
	 * @param nodeId - The node UUID to select
	 */
	selectNode(nodeId: string): void {
		this.nodes = this.nodes.map((n) => ({
			...n,
			selected: n.id === nodeId
		}));
	}

	/**
	 * Deselect all nodes
	 */
	deselectAllNodes(): void {
		this.nodes = this.nodes.map((n) => ({
			...n,
			selected: false
		}));
	}

	/**
	 * Select a single edge (cable) by ID
	 * @param edgeId - The edge ID to select
	 */
	selectEdge(edgeId: string): void {
		this.edges = this.edges.map((e) => ({
			...e,
			selected: e.id === edgeId
		}));
	}

	/**
	 * Deselect all edges
	 */
	deselectAllEdges(): void {
		this.edges = this.edges.map((e) => ({
			...e,
			selected: false
		}));
	}

	/**
	 * Handle node drag stop - saves position via form action
	 * @param event - Event object from SvelteFlow
	 */
	async handleNodeDragStop(event: NodeDragStopEvent): Promise<void> {
		const node = event.targetNode;
		const nodeId = node.id;
		const newPosition = node.position;

		const originalNode = this.nodes.find((n) => n.id === nodeId);
		if (!originalNode) return;
		const originalPosition = { ...originalNode.position };

		try {
			const formData = new FormData();
			formData.append('nodeId', nodeId);
			if (this.isChildView) {
				formData.append('child_canvas_x', newPosition.x.toString());
				formData.append('child_canvas_y', newPosition.y.toString());
			} else {
				formData.append('canvas_x', newPosition.x.toString());
				formData.append('canvas_y', newPosition.y.toString());
			}

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
		} catch (error: unknown) {
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
				description: `${(error as Error).message}`
			});
		}
	}

	/**
	 * Generate random string for cable names
	 * @param length - The length of the random string
	 */
	generateRandomString(length: number = 10): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const array = new Uint32Array(length);
		crypto.getRandomValues(array);
		return Array.from(array, (x) => chars[x % chars.length]).join('');
	}

	/**
	 * Parse handle ID to extract position
	 * @param handleId - Handle ID format: nodeUuid-position-type
	 */
	parseHandlePosition(handleId: string | undefined): string | null {
		if (!handleId) return null;
		const parts = handleId.split('-');
		return parts[parts.length - 2];
	}

	/**
	 * Handle new edge connection - creates a Cable record via form action
	 * @param connection - Connection object from SvelteFlow
	 * @param selectedProject - Current project ID
	 */
	async handleConnect(connection: SvelteFlowConnection, selectedProject: string): Promise<void> {
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
				message: m.message_error_no_cable_type_selected(),
				path: page.url.pathname,
				extraData: {
					source,
					target,
					cableName,
					from: 'handleConnect',
					message: 'No cable type selected when attempting to create cable'
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
			if (handleEnd) formData.append('handle_start', handleEnd);
			if (handleStart) formData.append('handle_end', handleStart);
			if (this.parentNodeContext) {
				formData.append('parent_node_context_id', this.parentNodeContext);
			}

			const response = await fetch('?/createCable', {
				method: 'POST',
				body: formData
			});

			const result: ActionResult = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				const errorData = result.type === 'failure' ? result.data : undefined;
				throw new Error(
					((errorData as Record<string, unknown> | undefined)?.error as string) ||
						'Failed to create cable'
				);
			}

			const successData = result.type === 'success' ? result.data : undefined;
			const cableData = (successData as Record<string, unknown> | undefined)?.data as CableData;

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
						onEdgeDelete: (edgeId: string) => this.handleEdgeDelete(edgeId),
						onEdgeSelect: (edgeId: string) => this.selectEdge(edgeId),
						onNameUpdate: (newName: string) => this.updateEdgeName(cableUuid, newName)
					}
				}
			];

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_cable()
			});

			if (cableData.warning) {
				await logToBackendClient({
					level: 'WARNING',
					message: m.message_error_no_cable_type_selected(),
					path: page.url.pathname,
					extraData: {
						source,
						target,
						cableName,
						from: 'handleConnect',
						message: cableData.warning
					},
					project: selectedProject
				});

				globalToaster.warning({
					title: m.common_warning(),
					description: m.message_warning_cable_type_incomplete_color_mappings()
				});
			}

			window.dispatchEvent(
				new CustomEvent('cableConnectionChanged', {
					detail: { nodeIds: [source, target] }
				})
			);

			await this.autoLinkMicropipe(cableUuid, cableName);
		} catch (error: unknown) {
			console.error('Error creating cable:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_cable()
			});
		}
	}

	/**
	 * Update edge data in local state
	 * @param edgeId - Edge UUID
	 * @param updates - Updates to apply to edge data
	 */
	updateEdge(edgeId: string, updates: Partial<SvelteFlowEdge>): void {
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
	 * @param cableId - Cable UUID
	 * @param handleStart - Start handle position
	 * @param handleEnd - End handle position
	 */
	updateCableHandles(cableId: string, handleStart: string, handleEnd: string): void {
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

	/**
	 * Update node name in local state
	 * @param nodeId - Node UUID
	 * @param newName - New name for the node
	 */
	updateNodeName(nodeId: string, newName: string): void {
		this.nodes = this.nodes.map((node) => {
			if (node.id === nodeId) {
				return {
					...node,
					data: {
						...node.data,
						label: newName,
						node: {
							...node.data.node,
							name: newName
						}
					}
				};
			}
			return node;
		});
	}

	/**
	 * Update edge/cable name in local state
	 * @param edgeId - Edge UUID
	 * @param newName - New name for the cable
	 */
	updateEdgeName(edgeId: string, newName: string): void {
		this.edges = this.edges.map((edge) => {
			if (edge.id === edgeId) {
				return {
					...edge,
					data: {
						...edge.data,
						label: newName,
						cable: {
							...edge.data.cable,
							name: newName
						},
						labelData: edge.data.labelData ? { ...edge.data.labelData, text: newName } : null
					}
				};
			}
			return edge;
		});
	}

	/**
	 * Update edge connection to a different node
	 * @param edgeId - Edge UUID
	 * @param side - 'start' or 'end'
	 * @param newNodeId - New node UUID
	 * @param handlePosition - Handle position at new node
	 */
	updateEdgeConnection(
		edgeId: string,
		side: 'start' | 'end',
		newNodeId: string,
		handlePosition: string
	): void {
		this.edges = this.edges.map((edge) => {
			if (edge.id === edgeId) {
				if (side === 'start') {
					return {
						...edge,
						source: newNodeId,
						sourceHandle: handlePosition ? `${newNodeId}-${handlePosition}-source` : undefined,
						data: {
							...edge.data,
							cable: {
								...edge.data.cable,
								uuid_node_start: newNodeId,
								handle_start: handlePosition
							}
						}
					};
				} else {
					return {
						...edge,
						target: newNodeId,
						targetHandle: handlePosition ? `${newNodeId}-${handlePosition}-target` : undefined,
						data: {
							...edge.data,
							cable: {
								...edge.data.cable,
								uuid_node_end: newNodeId,
								handle_end: handlePosition
							}
						}
					};
				}
			}
			return edge;
		});
	}

	/**
	 * Update edge label data (position and text) in local state
	 * @param edgeId - Edge UUID
	 * @param labelData - Label data with position_x, position_y, text, uuid
	 */
	updateEdgeLabelData(edgeId: string, labelData: EdgeLabelData): void {
		this.edges = this.edges.map((edge) => {
			if (edge.id === edgeId) {
				return {
					...edge,
					data: {
						...edge.data,
						labelData: labelData
					}
				};
			}
			return edge;
		});
	}

	/**
	 * Update edge micropipe connections for dynamic coloring
	 * @param cableId - Cable UUID
	 * @param connections - Array of micropipe connection objects
	 */
	updateEdgeMicropipeConnections(cableId: string, connections: MicropipeConnection[]): void {
		const sortedConnections = [...connections].sort((a, b) => a.number - b.number);
		const lowestMicropipe = sortedConnections[0] || null;

		this.edges = this.edges.map((edge) => {
			if (edge.id === cableId) {
				return {
					...edge,
					data: {
						...edge.data,
						micropipeConnections: connections,
						lowestMicropipe: lowestMicropipe,
						isConnected: connections.length > 0
					}
				};
			}
			return edge;
		});
	}

	/**
	 * Auto-link a freshly created cable to microducts matched via its end-node addresses.
	 * Single matches are linked directly with a toast; ambiguous ends are queued
	 * in pendingMicroductChoices for the user to resolve in a dialog.
	 * @param cableId - Cable UUID
	 * @param cableName - Cable name for dialog context
	 */
	async autoLinkMicropipe(cableId: string, cableName: string): Promise<void> {
		try {
			const formData = new FormData();
			formData.append('cableId', cableId);

			const response = await fetch('?/autoLinkMicropipe', {
				method: 'POST',
				body: formData
			});
			const result: ActionResult = deserialize(await response.text());
			if (result.type !== 'success' || !result.data) return;

			const data = result.data as unknown as AutoLinkResponse;
			for (const endResult of data.results ?? []) {
				if (endResult.status === 'linked') {
					globalToaster.success({
						title: m.title_success(),
						description: m.message_auto_link_micropipe_linked({
							micropipe: this.formatMicroductLabel(endResult.microduct ?? null)
						})
					});
				} else if (endResult.status === 'multiple_candidates') {
					this.pendingMicroductChoices = [
						...this.pendingMicroductChoices,
						{
							cableId,
							cableName,
							end: endResult.end ?? '',
							nodeName: endResult.node_name ?? null,
							address: endResult.address ?? null,
							candidates: endResult.candidates ?? []
						}
					];
				}
			}

			if ((data.linked_count ?? 0) > 0) {
				await this.refreshEdgeMicropipes(cableId);
			}
		} catch (error: unknown) {
			console.error('Error auto-linking micropipe:', error);
		}
	}

	/**
	 * Link the current pending choice's cable to the chosen microduct.
	 * @param microductUuid - UUID of the chosen microduct
	 */
	async chooseMicroduct(microductUuid: string): Promise<void> {
		const choice = this.pendingMicroductChoices[0];
		if (!choice) return;

		try {
			const formData = new FormData();
			formData.append('cableId', choice.cableId);
			formData.append('microductUuid', microductUuid);

			const response = await fetch('?/autoLinkMicropipe', {
				method: 'POST',
				body: formData
			});
			const result: ActionResult = deserialize(await response.text());
			if (result.type !== 'success' || !result.data) {
				throw new Error('Failed to link chosen microduct');
			}

			const data = result.data as unknown as AutoLinkResponse;
			globalToaster.success({
				title: m.title_success(),
				description: m.message_auto_link_micropipe_linked({
					micropipe: this.formatMicroductLabel(data.microduct ?? null)
				})
			});
			await this.refreshEdgeMicropipes(choice.cableId);
			this.pendingMicroductChoices = this.pendingMicroductChoices.slice(1);
		} catch (error: unknown) {
			console.error('Error linking chosen microduct:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_auto_link_micropipe_failed()
			});
		}
	}

	/**
	 * Dismiss the current pending microduct choice without linking.
	 */
	dismissMicroductChoice(): void {
		this.pendingMicroductChoices = this.pendingMicroductChoices.slice(1);
	}

	/**
	 * Build a human-readable label for a microduct candidate.
	 */
	formatMicroductLabel(microduct: MicroductCandidate | null): string {
		if (!microduct) return '';
		return `${microduct.conduit_name} #${microduct.number} ${microduct.color}`;
	}

	/**
	 * Refresh the micropipe connections of an edge for dynamic coloring.
	 * @param cableId - Cable UUID
	 */
	async refreshEdgeMicropipes(cableId: string): Promise<void> {
		try {
			const formData = new FormData();
			formData.append('uuid', cableId);

			const response = await fetch('?/getMicropipeConnectionsForCable', {
				method: 'POST',
				body: formData
			});
			const result: ActionResult = deserialize(await response.text());
			if (result.type === 'success' && result.data?.connections) {
				this.updateEdgeMicropipeConnections(
					cableId,
					result.data.connections as MicropipeConnection[]
				);
			}
		} catch (error: unknown) {
			console.error('Error refreshing edge micropipe connections:', error);
		}
	}
}
