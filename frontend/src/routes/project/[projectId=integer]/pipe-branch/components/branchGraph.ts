import type { Connection, Edge, Node } from '@xyflow/svelte';
import type {
	BranchConnection,
	MicroductEnd,
	MicroductPair
} from '$lib/remote/pipe-branch/connection-data';
import type {
	TrenchesNearNodeConduit,
	TrenchesNearNodeMicroduct,
	TrenchesNearNodeTrench
} from '$lib/types';

/** The conduit a canvas node stands for, together with the trench it lies in. */
export interface BranchNodeData extends Record<string, unknown> {
	trench: TrenchesNearNodeTrench;
	conduit: TrenchesNearNodeConduit;
	totalMicroducts: number;
}

export type BranchNode = Node<BranchNodeData, 'pipeBranch'>;

/** The microduct behind one handle of an edge, for the edge label. */
export interface HandleData {
	microductUuid: string;
	microductNumber: number;
	conduitName: string;
	conduitUuid: string;
}

/** `uuid` is `null` while the connection is still being saved. */
export interface BranchEdgeData extends Record<string, unknown> {
	uuid: string | null;
	sourceHandleData: HandleData;
	targetHandleData: HandleData;
}

export type BranchEdge = Edge<BranchEdgeData, 'pipeBranchEdge'>;

const CANVAS_CENTER = { x: 400, y: 300 };

interface LocatedMicroduct {
	trench: TrenchesNearNodeTrench;
	conduit: TrenchesNearNodeConduit;
	microduct: TrenchesNearNodeMicroduct;
}

/**
 * Identifies a conduit within one trench. The same conduit can run through
 * several trenches and is selected per trench.
 * @param trenchUuid - Trench UUID.
 * @param conduitUuid - Conduit UUID.
 * @returns The key in the format `trenchUuid:conduitUuid`.
 */
export function conduitKey(trenchUuid: string, conduitUuid: string): string {
	return `${trenchUuid}:${conduitUuid}`;
}

function branchNodeId(trenchUuid: string, conduitUuid: string): string {
	return `trench-${trenchUuid}-conduit-${conduitUuid}`;
}

/**
 * Names the handle of a microduct on its conduit's canvas node. Every
 * microduct has one handle per side, stacked on the same spot.
 * @param conduitUuid - Conduit UUID.
 * @param microductNumber - Position of the microduct within the conduit.
 * @param side - Whether connections start or end at the handle.
 * @returns The handle ID.
 */
export function handleId(
	conduitUuid: string,
	microductNumber: number,
	side: 'source' | 'target'
): string {
	return `conduit-${conduitUuid}-microduct-${microductNumber}-${side}`;
}

/**
 * @param handle - A handle ID built by {@link handleId}.
 * @returns Whether connections end at the handle.
 */
export function isTargetHandle(handle: string | null | undefined): boolean {
	return handle?.endsWith('-target') ?? false;
}

function locateMicroduct(
	trenches: TrenchesNearNodeTrench[],
	{ trenchUuid, microductUuid }: MicroductEnd
): LocatedMicroduct | null {
	const trench = trenches.find((t) => t.uuid === trenchUuid);
	for (const conduit of trench?.conduits ?? []) {
		const microduct = conduit.microducts.find((m) => m.uuid === microductUuid);
		if (trench && microduct) return { trench, conduit, microduct };
	}
	return null;
}

function toHandleData({ conduit, microduct }: LocatedMicroduct): HandleData {
	return {
		microductUuid: microduct.uuid,
		microductNumber: microduct.number,
		conduitName: conduit.name,
		conduitUuid: conduit.uuid
	};
}

/**
 * Lays the conduits of the given trenches out on a circle, one canvas node per
 * conduit. The circle grows with the number of conduits.
 * @param trenches - The trenches loaded onto the canvas, holding only their selected conduits.
 * @returns The canvas nodes.
 */
export function toBranchNodes(trenches: TrenchesNearNodeTrench[]): BranchNode[] {
	const placed = trenches.flatMap((trench) =>
		(trench.conduits ?? []).map((conduit) => ({ trench, conduit }))
	);
	const radius = Math.max(800, placed.length * 50);

	return placed.map(({ trench, conduit }, index) => {
		const angle = (index * 2 * Math.PI) / placed.length;
		return {
			id: branchNodeId(trench.uuid, conduit.uuid),
			type: 'pipeBranch',
			position: {
				x: CANVAS_CENTER.x + radius * Math.cos(angle),
				y: CANVAS_CENTER.y + radius * Math.sin(angle)
			},
			selected: false,
			zIndex: 1,
			data: { trench, conduit, totalMicroducts: conduit.microducts?.length ?? 0 }
		};
	});
}

/**
 * Builds the canvas edges of a node's connections. A connection is skipped
 * when one of its conduits is not on the canvas.
 * @param connections - The node's connections, including ones still being saved.
 * @param trenches - The trenches loaded onto the canvas.
 * @returns The canvas edges.
 */
export function toConnectionEdges(
	connections: BranchConnection[],
	trenches: TrenchesNearNodeTrench[]
): BranchEdge[] {
	return connections.flatMap((connection) => {
		const source = locateMicroduct(trenches, connection.from);
		const target = locateMicroduct(trenches, connection.to);
		if (!source || !target) return [];

		return [
			{
				id: connection.uuid
					? `connection-${connection.uuid}`
					: `pending-${connection.from.microductUuid}-${connection.to.microductUuid}`,
				type: 'pipeBranchEdge',
				source: branchNodeId(source.trench.uuid, source.conduit.uuid),
				target: branchNodeId(target.trench.uuid, target.conduit.uuid),
				sourceHandle: handleId(source.conduit.uuid, source.microduct.number, 'source'),
				targetHandle: handleId(target.conduit.uuid, target.microduct.number, 'target'),
				zIndex: 10,
				data: {
					uuid: connection.uuid,
					sourceHandleData: toHandleData(source),
					targetHandleData: toHandleData(target)
				}
			}
		];
	});
}

function handleEnd(
	nodes: BranchNode[],
	nodeId: string,
	handle: string | null | undefined
): MicroductEnd | null {
	const node = nodes.find((n) => n.id === nodeId);
	const number = handle?.match(/-microduct-(\d+)-(?:source|target)$/)?.[1];
	if (!node || number === undefined) return null;

	const microduct = node.data.conduit.microducts.find((m) => m.number === Number(number));
	return microduct ? { microductUuid: microduct.uuid, trenchUuid: node.data.trench.uuid } : null;
}

/**
 * Resolves a connection dragged between two handles to the microducts behind them.
 * @param connection - The connection SvelteFlow proposes.
 * @param nodes - The canvas nodes.
 * @returns The microduct pair, or `null` when a handle cannot be resolved.
 */
export function connectionPair(
	connection: Pick<Connection, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>,
	nodes: BranchNode[]
): MicroductPair | null {
	const from = handleEnd(nodes, connection.source, connection.sourceHandle);
	const to = handleEnd(nodes, connection.target, connection.targetHandle);
	return from && to ? { from, to } : null;
}

/**
 * Pairs the microducts of two conduits by number, leaving out pairs that are
 * already connected in either direction.
 * @param source - Canvas node of the first conduit.
 * @param target - Canvas node of the second conduit.
 * @param connections - The node's existing connections.
 * @returns The pairs that can still be connected.
 */
export function matchingMicroductPairs(
	source: BranchNode,
	target: BranchNode,
	connections: BranchConnection[]
): MicroductPair[] {
	const isConnected = (a: string, b: string) =>
		connections.some(
			({ from, to }) =>
				(from.microductUuid === a && to.microductUuid === b) ||
				(from.microductUuid === b && to.microductUuid === a)
		);

	return source.data.conduit.microducts.flatMap((sourceMicroduct) => {
		const targetMicroduct = target.data.conduit.microducts.find(
			(m) => m.number === sourceMicroduct.number
		);
		if (!targetMicroduct || isConnected(sourceMicroduct.uuid, targetMicroduct.uuid)) return [];

		return [
			{
				from: { microductUuid: sourceMicroduct.uuid, trenchUuid: source.data.trench.uuid },
				to: { microductUuid: targetMicroduct.uuid, trenchUuid: target.data.trench.uuid }
			}
		];
	});
}

/**
 * Lists the conduits that carry a connection and therefore cannot be taken
 * off the canvas.
 * @param connections - The node's connections.
 * @param trenches - The trenches near the node.
 * @returns The conduit keys, each once.
 */
export function lockedConduitKeys(
	connections: BranchConnection[],
	trenches: TrenchesNearNodeTrench[]
): string[] {
	const keys = connections.flatMap(({ from, to }) =>
		[from, to].flatMap((end) => {
			const located = locateMicroduct(trenches, end);
			return located ? [conduitKey(located.trench.uuid, located.conduit.uuid)] : [];
		})
	);
	return [...new Set(keys)];
}

/**
 * Builds the selection a trench selector opens with: every conduit of the
 * trenches saved for the node, plus the locked conduits.
 * @param trenches - The trenches near the node.
 * @param savedTrenchUuids - UUIDs of the trenches saved for the node.
 * @param lockedKeys - Keys of the conduits that carry a connection.
 * @returns The preselected conduit keys, each once.
 */
export function preselectedKeys(
	trenches: TrenchesNearNodeTrench[],
	savedTrenchUuids: string[],
	lockedKeys: string[]
): string[] {
	const savedKeys = trenches
		.filter((trench) => savedTrenchUuids.includes(trench.uuid))
		.flatMap((trench) => (trench.conduits ?? []).map((c) => conduitKey(trench.uuid, c.uuid)));
	return [...new Set([...savedKeys, ...lockedKeys])];
}
