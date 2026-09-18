import type { Node, XYPosition } from '@xyflow/svelte';
import type { TrenchProfileConduit, TrenchProfileMicroduct } from '$lib/remote/map/trench-data';

const DEFAULT_NODE_SIZE = 80;
const GRID_SPACING = 120;

export type ProfileNodeData = {
	conduit: {
		uuid: string;
		conduit_name: string;
		conduit_type: string;
		microducts: TrenchProfileMicroduct[];
	};
};

export type ProfileNode = Node<ProfileNodeData, 'trenchProfileNode'>;

/** Where a conduit sits on the profile canvas, in the shape the save command takes. */
export interface ProfilePlacement {
	conduitUuid: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Reads the saved canvas position of a conduit.
 * @param conduit - The conduit of the trench profile.
 * @returns The saved position, or `null` when the conduit was never placed.
 */
function savedPosition(conduit: TrenchProfileConduit): XYPosition | null {
	if (!conduit.has_saved_position || conduit.canvas_x === null || conduit.canvas_y === null) {
		return null;
	}
	return { x: conduit.canvas_x, y: conduit.canvas_y };
}

/**
 * Builds the SvelteFlow node of one conduit.
 * @param conduit - The conduit of the trench profile.
 * @param position - Where the node sits on the canvas.
 * @returns The conduit's node.
 */
function toProfileNode(conduit: TrenchProfileConduit, position: XYPosition): ProfileNode {
	const width = conduit.canvas_width || DEFAULT_NODE_SIZE;
	const height = conduit.canvas_height || DEFAULT_NODE_SIZE;
	const data: ProfileNodeData = {
		conduit: {
			uuid: conduit.conduit_uuid,
			conduit_name: conduit.conduit_name,
			conduit_type: conduit.conduit_type,
			microducts: conduit.microducts || []
		}
	};

	return {
		id: conduit.conduit_uuid,
		type: 'trenchProfileNode',
		position,
		style: `width: ${width}px; height: ${height}px;`,
		selected: false,
		data
	};
}

/**
 * Turns the conduits of a trench profile into SvelteFlow nodes. Conduits without
 * a saved placement are laid out on a square grid.
 * @param conduits - The conduits of the trench profile.
 * @returns One node per conduit that has a UUID.
 */
export function toProfileNodes(conduits: TrenchProfileConduit[]): ProfileNode[] {
	return conduits
		.filter((conduit) => conduit.conduit_uuid)
		.map((conduit, index) =>
			toProfileNode(conduit, savedPosition(conduit) ?? gridPosition(index, conduits.length))
		);
}

/**
 * Position of the n-th conduit on a square grid.
 * @param index - Index of the conduit.
 * @param total - Total number of conduits.
 * @returns The grid position.
 */
export function gridPosition(index: number, total: number): XYPosition {
	const columns = Math.ceil(Math.sqrt(total));

	return {
		x: (index % columns) * GRID_SPACING,
		y: Math.floor(index / columns) * GRID_SPACING
	};
}

/**
 * Reads the placement to persist from a node, preferring its measured size.
 * @param node - The moved or resized node.
 * @returns The node's placement on the canvas.
 */
export function nodePlacement(
	node: Pick<Node, 'id' | 'position' | 'measured' | 'width' | 'height'>
): ProfilePlacement {
	return {
		conduitUuid: node.id,
		x: node.position.x,
		y: node.position.y,
		width: node.measured?.width || node.width || DEFAULT_NODE_SIZE,
		height: node.measured?.height || node.height || DEFAULT_NODE_SIZE
	};
}
