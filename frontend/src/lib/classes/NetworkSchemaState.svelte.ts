import { page } from '$app/state';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';
import { trackPendingWrite } from '$lib/utils/pendingWrites';
import { createCable, getCableDetails } from '$lib/remote/network-schema/cables.remote';
import {
	deleteCableLabel as deleteCableLabelCommand,
	upsertCableLabel
} from '$lib/remote/network-schema/labels.remote';
import {
	autoLinkMicropipe as autoLinkMicropipeCommand,
	getMicropipeConnectionsForCable
} from '$lib/remote/network-schema/micropipes.remote';
import { getNodeDetails, saveNodeGeometry } from '$lib/remote/network-schema/nodes.remote';
import { saveCableGeometry as saveCableGeometryCommand } from '$lib/remote/network-schema/paths.remote';

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

export interface Waypoint {
	x: number;
	y: number;
}

export interface CableData {
	uuid: string;
	name: string;
	uuid_node_start: string;
	uuid_node_end: string;
	handle_start?: string;
	handle_end?: string;
	labelData?: EdgeLabelData | null;
	diagram_path?: Waypoint[];
	warning?: string;
}

export interface MicropipeConnection {
	number: number;
	color_hex: string;
	color_name?: string | null;
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
	};
}

/**
 * Cable-type combobox row. The page server loads map the raw API payload to
 * `{ value: item.id, label: item.cable_type }` before it reaches this class.
 */
export interface CableType {
	value: string | number;
	label: string;
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
	sourceHandle?: string | null;
	targetHandle?: string | null;
}

export interface NodeDragStopEvent {
	targetNode: { id: string; position: { x: number; y: number } } | null;
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

export interface AutoLinkEndResult {
	status: 'linked' | 'multiple_candidates' | string;
	microduct?: MicroductCandidate;
	end?: string;
	node_name?: string | null;
	address?: string | null;
	candidates?: MicroductCandidate[];
}

export interface AutoLinkResponse {
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

	/**
	 * Single source of truth for the canvas lock. When true the whole schema is
	 * frozen: SvelteFlow node dragging/selection/connecting is disabled via the
	 * `nodesDraggable`/`elementsSelectable`/`nodesConnectable` props, and the
	 * custom cable (edge waypoint) and label interactions read this flag to
	 * suppress their own drag/click handlers. The lock button in the Controls
	 * toggles this instead of the built-in interactivity (which SvelteFlow
	 * derives from these props and so cannot be written to directly).
	 */
	locked: boolean = $state(true);

	/**
	 * True while the Shift key is held. Single source for the delete/reset hover
	 * cues across every edge and label instance, replacing per-instance window
	 * listeners. The page registers one keydown/keyup pair plus blur/visibility
	 * resets so the cue can never get stuck when a keyup is missed off-window.
	 */
	shiftPressed: boolean = $state(false);

	/** Track if already initialized to prevent duplicate initialization */
	#initialized: boolean = $state(false);

	/**
	 * Latest waypoints produced during an in-flight vertex drag, keyed by edge.
	 * The drag end saves from this buffer instead of `edge.data.cable.diagram_path`,
	 * which may not have round-tripped through state yet when the drag finishes.
	 */
	#dragWaypoints: Map<string, Waypoint[]> = new Map();

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
					node: node
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
						isConnected: connections.length > 0
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
	 * Update Shift state from a keyboard event. Registered once at page root.
	 * @param event - The keydown/keyup event
	 */
	setShiftFromKeyboard(event: KeyboardEvent): void {
		if (event.key === 'Shift') {
			this.shiftPressed = event.type === 'keydown';
		}
	}

	/**
	 * Force-clear Shift. Called on window blur / tab hide so the hover cue can
	 * never lie after a keyup was missed while focus was outside the window.
	 */
	clearShift(): void {
		this.shiftPressed = false;
	}

	/**
	 * Handle node drag stop - saves position via form action
	 * @param event - Event object from SvelteFlow
	 */
	async handleNodeDragStop(event: NodeDragStopEvent): Promise<void> {
		const node = event.targetNode;
		if (!node) return;
		const nodeId = node.id;
		const newPosition = node.position;

		const originalNode = this.nodes.find((n) => n.id === nodeId);
		if (!originalNode) return;
		const originalPosition = { ...originalNode.position };

		try {
			await saveNodeGeometry({
				nodeId,
				x: newPosition.x,
				y: newPosition.y,
				isChildView: this.isChildView
			});

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_position()
			});
		} catch (error: unknown) {
			console.error('Error saving node position:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving node position',
				extraData: {
					from: 'NetworkSchemaState.handleNodeDragStop',
					nodeId,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});

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
	parseHandlePosition(handleId: string | null | undefined): string | null {
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
			const cableData = await createCable({
				uuid: cableUuid,
				name: cableName,
				cableTypeId: parseInt(this.selectedCableType[0], 10),
				projectId: parseInt(selectedProject, 10),
				flagId: 1,
				nodeStartId: target,
				nodeEndId: source,
				handleStart: handleEnd ?? undefined,
				handleEnd: handleStart ?? undefined,
				parentNodeContextId: this.parentNodeContext ?? undefined
			});

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
						cable: { ...cableData, uuid: cableUuid }
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
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error creating cable',
				extraData: {
					from: 'NetworkSchemaState.handleConnect',
					source,
					target,
					cableName,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
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
	 * @param labelData - Label data with position_x, position_y, text, uuid, or null to clear
	 */
	updateEdgeLabelData(edgeId: string, labelData: EdgeLabelData | null): void {
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
	 * Set an edge's diagram path waypoints in local state without persisting.
	 * Used for adding a vertex and for the live frames of a vertex drag.
	 * @param edgeId - Edge/cable UUID
	 * @param waypoints - Full waypoint list for the edge
	 */
	updateCablePathWaypoints(edgeId: string, waypoints: Waypoint[]): void {
		this.edges = this.edges.map((edge) => {
			if (edge.id === edgeId) {
				return {
					...edge,
					data: {
						...edge.data,
						cable: {
							...edge.data.cable,
							diagram_path: waypoints
						}
					}
				};
			}
			return edge;
		});
	}

	/**
	 * Persist an edge's diagram path to the backend, optimistically updating local
	 * state first and rolling back on failure.
	 * @param edgeId - Edge/cable UUID
	 * @param waypoints - Full waypoint list to save
	 */
	async saveCablePath(edgeId: string, waypoints: Waypoint[]): Promise<void> {
		const originalEdge = this.edges.find((e) => e.id === edgeId);
		const originalWaypoints = originalEdge?.data.cable.diagram_path
			? [...(originalEdge.data.cable.diagram_path as Waypoint[])]
			: undefined;

		this.updateCablePathWaypoints(edgeId, waypoints);

		try {
			await trackPendingWrite(
				saveCableGeometryCommand({ cableId: edgeId, diagramPath: waypoints })
			);

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_cable_path()
			});
		} catch (error: unknown) {
			console.error('Error saving cable path:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving cable path',
				extraData: {
					from: 'NetworkSchemaState.saveCablePath',
					edgeId,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});

			if (originalWaypoints !== undefined) {
				this.updateCablePathWaypoints(edgeId, originalWaypoints);
			}

			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_cable_path()
			});
		}
	}

	/**
	 * Seed the drag buffer for an edge from its current diagram path.
	 * @param edgeId - Edge/cable UUID
	 */
	beginPathDrag(edgeId: string): void {
		const edge = this.edges.find((e) => e.id === edgeId);
		const current = (edge?.data.cable.diagram_path as Waypoint[] | undefined) ?? [];
		this.#dragWaypoints.set(edgeId, [...current]);
	}

	/**
	 * Move a single waypoint during a drag: update the buffer and the live edge.
	 * @param edgeId - Edge/cable UUID
	 * @param index - Index of the waypoint being dragged
	 * @param point - New snapped waypoint position
	 */
	dragPathVertex(edgeId: string, index: number, point: Waypoint): void {
		const edge = this.edges.find((e) => e.id === edgeId);
		const base =
			this.#dragWaypoints.get(edgeId) ??
			(edge?.data.cable.diagram_path as Waypoint[] | undefined) ??
			[];
		const waypoints = [...base];
		waypoints[index] = point;
		this.#dragWaypoints.set(edgeId, waypoints);
		this.updateCablePathWaypoints(edgeId, waypoints);
	}

	/**
	 * Finish a drag: persist the buffered waypoints, then clear the buffer.
	 * @param edgeId - Edge/cable UUID
	 */
	async endPathDrag(edgeId: string): Promise<void> {
		const edge = this.edges.find((e) => e.id === edgeId);
		const waypoints =
			this.#dragWaypoints.get(edgeId) ??
			(edge?.data.cable.diagram_path as Waypoint[] | undefined) ??
			[];
		this.#dragWaypoints.delete(edgeId);
		await this.saveCablePath(edgeId, waypoints);
	}

	/**
	 * Reset (delete) a cable's label, optimistically clearing it and rolling back
	 * on failure.
	 * @param edgeId - Edge/cable UUID
	 * @param labelId - UUID of the label to delete
	 * @returns Whether the delete persisted, so callers can roll back their own optimistic state
	 */
	async resetLabel(edgeId: string, labelId: string): Promise<boolean> {
		if (!labelId) return false;

		const originalEdge = this.edges.find((e) => e.id === edgeId);
		const originalLabelData = originalEdge?.data.labelData ?? null;

		this.updateEdgeLabelData(edgeId, null);

		try {
			await trackPendingWrite(deleteCableLabelCommand({ labelId }));
			return true;
		} catch (error: unknown) {
			console.error('Failed to reset label:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Failed to reset label',
				extraData: {
					from: 'NetworkSchemaState.resetLabel',
					edgeId,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});

			this.updateEdgeLabelData(edgeId, originalLabelData);

			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_saving_cable_label()
			});
			return false;
		}
	}

	/**
	 * Persist a cable label's position (and text), optimistically updating local
	 * state and rolling back on failure.
	 * @param edgeId - Edge/cable UUID
	 * @param positionData - New position, optional text override, and optional existing label id
	 * @returns Whether the save persisted, so callers can clear their optimistic override
	 */
	async saveLabelPosition(
		edgeId: string,
		positionData: { x: number; y: number; text?: string; labelId?: string }
	): Promise<boolean> {
		const edge = this.edges.find((e) => e.id === edgeId);
		if (!edge) return false;

		const cableUuid = edge.data.cable.uuid;
		if (!cableUuid) return false;

		const originalLabelData = edge.data.labelData ?? null;
		const text = positionData.text || edge.data.label || edge.data.cable.name || '';

		try {
			const label = await trackPendingWrite(
				upsertCableLabel({
					cableId: cableUuid,
					positionX: positionData.x,
					positionY: positionData.y,
					text,
					order: 0,
					labelId: positionData.labelId
				})
			);

			this.updateEdgeLabelData(edgeId, label);
			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_saving_cable_label()
			});
			return true;
		} catch (error: unknown) {
			console.error('Failed to save label position:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Failed to save label position',
				extraData: {
					from: 'NetworkSchemaState.saveLabelPosition',
					edgeId,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});

			this.updateEdgeLabelData(edgeId, originalLabelData);

			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_saving_cable_label()
			});
			return false;
		}
	}

	/**
	 * Load a cable's full detail record for the cable-details drawer.
	 * @param uuid - Cable UUID
	 * @returns The cable detail object from the backend
	 */
	loadCableDetails(uuid: string): Promise<Record<string, unknown>> {
		return getCableDetails(uuid);
	}

	/**
	 * Load a node's full detail record for the node-details drawer.
	 * @param uuid - Node UUID
	 * @returns The node detail object from the backend
	 */
	loadNodeDetails(uuid: string): Promise<Record<string, unknown>> {
		return getNodeDetails(uuid);
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
			const data = await autoLinkMicropipeCommand({ cableId });

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
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error auto-linking micropipe',
				extraData: {
					from: 'NetworkSchemaState.autoLinkMicropipe',
					cableId,
					cableName,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
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
			const data = await autoLinkMicropipeCommand({
				cableId: choice.cableId,
				microductUuid
			});

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
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error linking chosen microduct',
				extraData: {
					from: 'NetworkSchemaState.chooseMicroduct',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
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
			const connections = await getMicropipeConnectionsForCable(cableId);
			this.updateEdgeMicropipeConnections(cableId, connections);
		} catch (error: unknown) {
			console.error('Error refreshing edge micropipe connections:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error refreshing edge micropipe connections',
				extraData: {
					from: 'NetworkSchemaState.refreshEdgeMicropipes',
					cableId,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
		}
	}
}
