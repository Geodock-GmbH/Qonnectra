<script>
	import { Controls, SvelteFlow, ViewportPortal } from '@xyflow/svelte';

	import { TrenchProfileState } from '$lib/classes/TrenchProfileState.svelte.js';

	import TrenchProfileBackground from './TrenchProfileBackground.svelte';
	import TrenchProfileFitView from './TrenchProfileFitView.svelte';
	import TrenchProfileNode from './TrenchProfileNode.svelte';

	import '@xyflow/svelte/dist/style.css';

	let { trenchUuid } = $props();

	const nodeTypes = { trenchProfileNode: TrenchProfileNode };

	const profileState = new TrenchProfileState();

	let previousTrenchUuid = $state(null);

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
	 * Handle node drag stop
	 * @param {Object} event - Drag event
	 */
	function handleNodeDragStop(event) {
		profileState.handleNodeDragStop(event);
	}

	/**
	 * Handle node changes including resize
	 * @param {Array} changes - Array of node changes
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
			<p>No conduits found in this trench.</p>
		</div>
	{:else}
		<div class="flow-wrapper">
			<SvelteFlow
				bind:nodes={profileState.nodes}
				edges={[]}
				{nodeTypes}
				onnodedragstop={handleNodeDragStop}
				onnodeschange={handleNodesChange}
				minZoom={0.1}
				maxZoom={2}
			>
				<ViewportPortal>
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
		color: var(--color-surface-500);
	}
</style>
