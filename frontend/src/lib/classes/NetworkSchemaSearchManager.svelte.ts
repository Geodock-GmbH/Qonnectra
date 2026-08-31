import type {
	NetworkSchemaState,
	SvelteFlowEdge,
	SvelteFlowNode
} from './NetworkSchemaState.svelte';

import { m } from '$lib/paraglide/messages';

interface NodeSearchResult {
	type: 'node';
	id: string;
	name: string;
	position: { x: number; y: number };
	data: SvelteFlowNode['data'];
}

interface EdgeSearchResult {
	type: 'cable';
	id: string;
	name: string;
	source: string;
	target: string;
	data: SvelteFlowEdge['data'];
}

export type SearchResult = NodeSearchResult | EdgeSearchResult;

/**
 * Search manager for the network schema diagram
 * Handles searching nodes and cables by name with configurable result behavior
 */
export class NetworkSchemaSearchManager {
	searchTerm: string = $state('');
	panToResult: boolean = $state(true);
	highlightResult: boolean = $state(true);
	openDrawer: boolean = $state(false);
	highlightedItemId: string | null = $state(null);

	#schemaState: NetworkSchemaState;

	constructor(schemaState: NetworkSchemaState) {
		this.#schemaState = schemaState;
	}

	/**
	 * Get combined search results from nodes and edges
	 */
	get searchResults(): SearchResult[] {
		const term = this.searchTerm.toLowerCase().trim();

		if (!term || term.length < 1) {
			return [];
		}

		const nodeResults: NodeSearchResult[] = this.#schemaState.nodes
			.filter((node: SvelteFlowNode) => {
				const name = node.data?.label || node.data?.node?.name || '';
				return (name as string).toLowerCase().includes(term);
			})
			.map((node: SvelteFlowNode) => ({
				type: 'node' as const,
				id: node.id,
				name: node.data?.label || (node.data?.node?.name as string) || m.form_unnamed_node(),
				position: node.position,
				data: node.data
			}));

		const edgeResults: EdgeSearchResult[] = this.#schemaState.edges
			.filter((edge: SvelteFlowEdge) => {
				const name = edge.data?.label || edge.data?.cable?.name || '';
				return (name as string).toLowerCase().includes(term);
			})
			.map((edge: SvelteFlowEdge) => ({
				type: 'cable' as const,
				id: edge.id,
				name: edge.data?.label || (edge.data?.cable?.name as string) || m.form_unnamed_cable(),
				source: edge.source,
				target: edge.target,
				data: edge.data
			}));

		return [...nodeResults, ...edgeResults];
	}

	/**
	 * Get the position to center on for a search result
	 * For nodes, returns the node position
	 * For cables, returns the midpoint between source and target nodes
	 */
	getResultPosition(result: SearchResult): { x: number; y: number } | null {
		if (result.type === 'node') {
			return result.position;
		}

		const sourceNode = this.#schemaState.nodes.find((n: SvelteFlowNode) => n.id === result.source);
		const targetNode = this.#schemaState.nodes.find((n: SvelteFlowNode) => n.id === result.target);

		if (sourceNode && targetNode) {
			return {
				x: (sourceNode.position.x + targetNode.position.x) / 2,
				y: (sourceNode.position.y + targetNode.position.y) / 2
			};
		}

		return null;
	}

	/**
	 * Set highlight on an item (node or cable)
	 * @param itemId - UUID of the item to highlight, or null to clear
	 */
	setHighlight(itemId: string | null): void {
		this.highlightedItemId = itemId;
	}

	/**
	 * Clear the highlight after a delay
	 * @param delay - Delay in milliseconds (default 3000)
	 */
	clearHighlightAfterDelay(delay: number = 3000): void {
		setTimeout(() => {
			this.highlightedItemId = null;
		}, delay);
	}

	/**
	 * Clear the search term and results
	 */
	clearSearch(): void {
		this.searchTerm = '';
		this.highlightedItemId = null;
	}

	/**
	 * Get a node by ID
	 */
	getNodeById(nodeId: string): SvelteFlowNode | undefined {
		return this.#schemaState.nodes.find((n: SvelteFlowNode) => n.id === nodeId);
	}

	/**
	 * Get an edge by ID
	 */
	getEdgeById(edgeId: string): SvelteFlowEdge | undefined {
		return this.#schemaState.edges.find((e: SvelteFlowEdge) => e.id === edgeId);
	}
}
