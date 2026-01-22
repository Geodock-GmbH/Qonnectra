import { m } from '$lib/paraglide/messages';

/**
 * Search manager for the network schema diagram
 * Handles searching nodes and cables by name with configurable result behavior
 */
export class NetworkSchemaSearchManager {
	/** @type {string} */
	searchTerm = $state('');

	/** @type {boolean} - Whether to pan viewport to the selected result */
	panToResult = $state(true);

	/** @type {boolean} - Whether to highlight the selected result */
	highlightResult = $state(true);

	/** @type {boolean} - Whether to open the drawer for the selected result */
	openDrawer = $state(true);

	/** @type {string|null} - UUID of the currently highlighted item */
	highlightedItemId = $state(null);

	/** @type {import('./NetworkSchemaState.svelte.js').NetworkSchemaState} */
	#schemaState;

	/**
	 * @param {import('./NetworkSchemaState.svelte.js').NetworkSchemaState} schemaState
	 */
	constructor(schemaState) {
		this.#schemaState = schemaState;
	}

	/**
	 * Get combined search results from nodes and edges
	 * @returns {Array<{type: 'node'|'cable', id: string, name: string, data: Object}>}
	 */
	get searchResults() {
		const term = this.searchTerm.toLowerCase().trim();

		if (!term || term.length < 1) {
			return [];
		}

		const nodeResults = this.#schemaState.nodes
			.filter((node) => {
				const name = node.data?.label || node.data?.node?.name || '';
				return name.toLowerCase().includes(term);
			})
			.map((node) => ({
				type: /** @type {'node'} */ ('node'),
				id: node.id,
				name: node.data?.label || node.data?.node?.name || m.form_unnamed_node(),
				position: node.position,
				data: node.data
			}));

		const edgeResults = this.#schemaState.edges
			.filter((edge) => {
				const name = edge.data?.label || edge.data?.cable?.name || '';
				return name.toLowerCase().includes(term);
			})
			.map((edge) => ({
				type: /** @type {'cable'} */ ('cable'),
				id: edge.id,
				name: edge.data?.label || edge.data?.cable?.name || m.form_unnamed_cable(),
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
	 * @param {Object} result - Search result object
	 * @returns {{x: number, y: number}|null}
	 */
	getResultPosition(result) {
		if (result.type === 'node') {
			return result.position;
		}

		// For cables, calculate midpoint between source and target nodes
		const sourceNode = this.#schemaState.nodes.find((n) => n.id === result.source);
		const targetNode = this.#schemaState.nodes.find((n) => n.id === result.target);

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
	 * @param {string|null} itemId - UUID of the item to highlight, or null to clear
	 */
	setHighlight(itemId) {
		this.highlightedItemId = itemId;
	}

	/**
	 * Clear the highlight after a delay
	 * @param {number} delay - Delay in milliseconds (default 3000)
	 */
	clearHighlightAfterDelay(delay = 3000) {
		setTimeout(() => {
			this.highlightedItemId = null;
		}, delay);
	}

	/**
	 * Clear the search term and results
	 */
	clearSearch() {
		this.searchTerm = '';
		this.highlightedItemId = null;
	}

	/**
	 * Get a node by ID
	 * @param {string} nodeId
	 * @returns {Object|undefined}
	 */
	getNodeById(nodeId) {
		return this.#schemaState.nodes.find((n) => n.id === nodeId);
	}

	/**
	 * Get an edge by ID
	 * @param {string} edgeId
	 * @returns {Object|undefined}
	 */
	getEdgeById(edgeId) {
		return this.#schemaState.edges.find((e) => e.id === edgeId);
	}
}
