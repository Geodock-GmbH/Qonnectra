import { deserialize } from '$app/forms';

import { m } from '$lib/paraglide/messages';

import { globalToaster } from '$lib/stores/toaster';
import { logToBackendClient } from '$lib/utils/logToBackendClient';

interface ConduitData {
	conduit_uuid: string;
	conduit_name: string;
	conduit_type: string;
	microducts: Microduct[];
	has_saved_position: boolean;
	canvas_x: number | null;
	canvas_y: number | null;
	canvas_width: number | null;
	canvas_height: number | null;
}

interface Microduct {
	uuid: string;
	color: string;
}

interface Position {
	x: number;
	y: number;
}

interface TrenchProfileNode {
	id: string;
	type: string;
	position: Position;
	style: string;
	selected: boolean;
	data: {
		conduit: {
			uuid: string;
			conduit_name: string;
			conduit_type: string;
			microducts: Microduct[];
		};
	};
}

interface FlowNode {
	id: string;
	position: Position;
	measured?: { width?: number; height?: number };
	width?: number;
	height?: number;
}

interface NodeDragEvent {
	targetNode: FlowNode | null;
}

/**
 * State manager for the trench profile canvas
 * Manages nodes (conduits) and their positions/sizes
 */
export class TrenchProfileState {
	nodes: TrenchProfileNode[] = $state.raw([]);
	trenchUuid: string | null = $state(null);
	isLoading: boolean = $state(false);

	#initialized: boolean = $state(false);

	/**
	 * Check if the state has been initialized
	 */
	get initialized(): boolean {
		return this.#initialized;
	}

	/**
	 * Initialize the state with trench data
	 * @param trenchUuid - UUID of the trench
	 */
	async initialize(trenchUuid: string): Promise<void> {
		if (!trenchUuid || this.#initialized) return;

		this.trenchUuid = trenchUuid;
		this.isLoading = true;

		try {
			const formData = new FormData();
			formData.append('trenchUuid', trenchUuid);

			const response = await fetch('?/getTrenchProfile', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && result.data) {
				const data = Array.isArray(result.data) ? result.data : [];
				this.nodes = this.transformToSvelteFlowNodes(data as ConduitData[]);
				this.#initialized = true;
			}
		} catch (error) {
			console.error('Error loading trench profile:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error loading trench profile',
				extraData: {
					from: 'TrenchProfileState.initialize',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description:
					(
						m as unknown as Record<string, ((...args: unknown[]) => string) | undefined>
					).message_error_loading_data?.() || 'Error loading data'
			});
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Reset state for a new trench
	 */
	reset(): void {
		this.nodes = [];
		this.trenchUuid = null;
		this.#initialized = false;
		this.isLoading = false;
	}

	/**
	 * Transform API data to SvelteFlow nodes
	 * @param conduits - Array of conduit data from API
	 */
	transformToSvelteFlowNodes(conduits: ConduitData[]): TrenchProfileNode[] {
		if (!conduits || !Array.isArray(conduits) || conduits.length === 0) {
			return [];
		}

		return conduits
			.filter((conduit) => conduit && conduit.conduit_uuid)
			.map((conduit, index) => {
				const hasPosition = conduit.has_saved_position && conduit.canvas_x !== null;
				const position = hasPosition
					? {
							x: conduit.canvas_x as number,
							y: conduit.canvas_y as number
						}
					: this.getGridPosition(index, conduits.length);

				const width = conduit.canvas_width || 80;
				const height = conduit.canvas_height || 80;

				return {
					id: conduit.conduit_uuid,
					type: 'trenchProfileNode',
					position,
					style: `width: ${width}px; height: ${height}px;`,
					selected: false,
					data: {
						conduit: {
							uuid: conduit.conduit_uuid,
							conduit_name: conduit.conduit_name,
							conduit_type: conduit.conduit_type,
							microducts: conduit.microducts || []
						}
					}
				};
			});
	}

	/**
	 * Calculate grid position for a conduit
	 * @param index - Index of the conduit
	 * @param total - Total number of conduits
	 */
	getGridPosition(index: number, total: number): Position {
		const GRID_SPACING = 120;
		const COLUMNS = Math.ceil(Math.sqrt(total));

		const row = Math.floor(index / COLUMNS);
		const col = index % COLUMNS;

		return {
			x: col * GRID_SPACING,
			y: row * GRID_SPACING
		};
	}

	/**
	 * Handle node drag stop - save new position
	 * @param event - SvelteFlow drag event
	 */
	async handleNodeDragStop(event: NodeDragEvent): Promise<void> {
		const node = event.targetNode;
		if (!node || !this.trenchUuid) return;

		const x = node.position?.x ?? 0;
		const y = node.position?.y ?? 0;
		const width = node.measured?.width || node.width || 80;
		const height = node.measured?.height || node.height || 80;

		await this.savePosition(node.id, x, y, width, height);
	}

	/**
	 * Save node after resize (called from onnodeschange)
	 * @param node - The resized node
	 */
	async saveNodeDimensions(node: FlowNode): Promise<void> {
		if (!node || !this.trenchUuid) return;

		const x = node.position?.x ?? 0;
		const y = node.position?.y ?? 0;
		const width = node.measured?.width || node.width || 80;
		const height = node.measured?.height || node.height || 80;

		await this.savePosition(node.id, x, y, width, height);
	}

	/**
	 * Save position to backend
	 * @param conduitUuid - UUID of the conduit
	 * @param x - X position
	 * @param y - Y position
	 * @param width - Width
	 * @param height - Height
	 */
	async savePosition(
		conduitUuid: string,
		x: number,
		y: number,
		width: number,
		height: number
	): Promise<void> {
		if (!this.trenchUuid || !conduitUuid) return;

		try {
			const formData = new FormData();
			formData.append('trenchUuid', this.trenchUuid);
			formData.append('conduitUuid', conduitUuid);
			formData.append('canvasX', String(x ?? 0));
			formData.append('canvasY', String(y ?? 0));
			formData.append('canvasWidth', String(width ?? 80));
			formData.append('canvasHeight', String(height ?? 80));

			const response = await fetch('?/saveTrenchProfilePosition', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type !== 'success') {
				throw new Error('Failed to save position');
			}
		} catch (error) {
			console.error('Error saving position:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving position',
				extraData: {
					from: 'TrenchProfileState.savePosition',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description:
					(
						m as unknown as Record<string, ((...args: unknown[]) => string) | undefined>
					).message_error_saving_data?.() || 'Error saving data'
			});
		}
	}
}
