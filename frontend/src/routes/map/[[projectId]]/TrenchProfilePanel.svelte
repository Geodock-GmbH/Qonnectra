<script>
	import { Controls, SvelteFlow, ViewportPortal } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import { TrenchProfileState } from '$lib/classes/TrenchProfileState.svelte.js';

	import '@xyflow/svelte/dist/style.css';

	import TrenchProfileBackground from './TrenchProfileBackground.svelte';
	import TrenchProfileFitView from './TrenchProfileFitView.svelte';
	import TrenchProfileNode from './TrenchProfileNode.svelte';

	let { trenchUuid } = $props();

	const nodeTypes = { trenchProfileNode: TrenchProfileNode };

	const profileState = new TrenchProfileState();

	let previousTrenchUuid = $state(null);
	let locked = $state(true);

	// @ts-ignore - onnodeschange exists but is missing from SvelteFlow types
	/** @type {any} */
	const nodesChangeProps = { onnodeschange: handleNodesChange };

	$effect(() => {
		if (trenchUuid && trenchUuid !== previousTrenchUuid) {
			previousTrenchUuid = trenchUuid;
			profileState.reset();
			profileState.initialize(trenchUuid);
		}
	});

	$effect(() => {
		return () => {
			profileState.reset();
		};
	});

	/**
	 * Persists conduit position after the user finishes dragging a node.
	 * @param {{ targetNode: import('@xyflow/svelte').Node | null, nodes: import('@xyflow/svelte').Node[], event: MouseEvent | TouchEvent }} event
	 */
	function handleNodeDragStop(event) {
		profileState.handleNodeDragStop(event);
	}

	/**
	 * Saves node dimensions when a resize operation completes.
	 * @param {any[]} changes
	 */
	function handleNodesChange(changes) {
		for (const change of changes) {
			if (change.type === 'dimensions' && change.resizing === false) {
				const node = profileState.nodes.find((n) => n.id === change.id);
				if (node) {
					profileState.saveNodeDimensions({
						...node,
						measured: change.dimensions
					});
				}
			}
		}
	}
</script>

<div class="trench-profile-container">
	{#if profileState.isLoading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
		</div>
	{:else if profileState.nodes.length === 0}
		<div class="empty-state">
			<p>{m.message_no_conduits_found_in_trench?.()}</p>
		</div>
	{:else}
		<div class="flow-wrapper">
			<SvelteFlow
				bind:nodes={profileState.nodes}
				edges={[]}
				{nodeTypes}
				onnodedragstop={handleNodeDragStop}
				{...nodesChangeProps}
				minZoom={0.1}
				maxZoom={2}
				nodesDraggable={!locked}
				nodesConnectable={!locked}
				elementsSelectable={!locked}
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

	.loading-overlay {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-height: 400px;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--color-surface-300);
		border-top-color: var(--color-primary-500);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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
