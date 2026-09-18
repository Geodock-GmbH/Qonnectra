<script lang="ts">
	import type { ProfilePlacement } from './profileNodes';
	import type { Node } from '@xyflow/svelte';
	import { Controls, SvelteFlow, ViewportPortal } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { getTrenchProfile, saveTrenchProfilePosition } from '$lib/remote/map/trenches.remote';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';

	import '@xyflow/svelte/dist/style.css';

	import TrenchProfileBackground from './TrenchProfileBackground.svelte';
	import TrenchProfileFitView from './TrenchProfileFitView.svelte';
	import TrenchProfileNode from './TrenchProfileNode.svelte';
	import { nodePlacement, toProfileNodes } from './profileNodes';

	let { trenchUuid }: { trenchUuid: string } = $props();

	const nodeTypes = { trenchProfileNode: TrenchProfileNode };

	// Written to by SvelteFlow while dragging and resizing; loading another
	// trench replaces it with that trench's saved placements.
	let nodes = $derived(toProfileNodes(await getTrenchProfile(trenchUuid)));

	/** The subset of a SvelteFlow node-change event this panel reacts to. */
	type NodeDimensionChange = {
		type: string;
		id?: string;
		resizing?: boolean;
		dimensions?: { width: number; height: number };
	};

	// onnodeschange exists but is missing from SvelteFlow's prop types
	const nodesChangeProps: { onnodeschange: (changes: NodeDimensionChange[]) => void } = {
		onnodeschange: handleNodesChange
	};

	/**
	 * Persists where a conduit sits on the canvas.
	 * @param placement - The conduit's new placement.
	 */
	async function savePlacement(placement: ProfilePlacement) {
		try {
			await saveTrenchProfilePosition({ trenchUuid, ...placement });
		} catch (error) {
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error saving trench profile position',
				extraData: {
					from: 'TrenchProfilePanel.savePlacement',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: remoteErrorMessage(error) ?? m.message_error_saving_data()
			});
		}
	}

	/**
	 * Persists conduit position after the user finishes dragging a node.
	 * @param event - Drag stop event from SvelteFlow
	 */
	function handleNodeDragStop({ targetNode }: { targetNode: Node | null }) {
		if (targetNode) savePlacement(nodePlacement(targetNode));
	}

	/**
	 * Saves node dimensions when a resize operation completes.
	 * @param changes - Node change events from SvelteFlow
	 */
	function handleNodesChange(changes: NodeDimensionChange[]) {
		for (const change of changes) {
			if (change.type !== 'dimensions' || change.resizing !== false) continue;

			const node = nodes.find((n) => n.id === change.id);
			if (node) savePlacement(nodePlacement({ ...node, measured: change.dimensions }));
		}
	}
</script>

<div class="trench-profile-container">
	{#if nodes.length === 0}
		<div class="empty-state">
			<p>{m.message_no_conduits_found_in_trench()}</p>
		</div>
	{:else}
		<div class="flow-wrapper">
			<!-- Opens locked; the lock button in Controls unlocks dragging and selecting. -->
			<SvelteFlow
				bind:nodes
				edges={[]}
				{nodeTypes}
				onnodedragstop={handleNodeDragStop}
				{...nodesChangeProps}
				minZoom={0.1}
				maxZoom={2}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
			>
				<ViewportPortal target="back">
					<TrenchProfileBackground />
				</ViewportPortal>
				<Controls />
				<TrenchProfileFitView />
			</SvelteFlow>
		</div>
	{/if}
</div>

<style>
	.trench-profile-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
	}

	.flow-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 400px;
		background: var(--color-surface-200);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-height: 400px;
		color: var(--color-surface-900-100);
	}
</style>
