<script>
	import { onMount } from 'svelte';
	import { Background, Controls, SvelteFlow } from '@xyflow/svelte';

	import { TrenchProfileState } from '$lib/classes/TrenchProfileState.svelte.js';

	import TrenchProfileFitView from './TrenchProfileFitView.svelte';
	import TrenchProfileNode from './TrenchProfileNode.svelte';

	import '@xyflow/svelte/dist/style.css';

	let { trenchUuid } = $props();

	const nodeTypes = { trenchProfileNode: TrenchProfileNode };

	const profileState = new TrenchProfileState();

	onMount(() => {
		if (trenchUuid) {
			profileState.initialize(trenchUuid);
		}

		return () => {
			profileState.reset();
		};
	});

	$effect(() => {
		if (trenchUuid && !profileState.initialized) {
			profileState.reset();
			profileState.initialize(trenchUuid);
		}
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
		<SvelteFlow
			bind:nodes={profileState.nodes}
			edges={[]}
			{nodeTypes}
			onnodedragstop={handleNodeDragStop}
			onnodeschange={handleNodesChange}
			minZoom={0.1}
			maxZoom={2}
		>
			<Background bgColor="var(--color-surface-100-900)" />
			<Controls />
			<TrenchProfileFitView />
		</SvelteFlow>
	{/if}
</div>

<style>
	.trench-profile-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
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
