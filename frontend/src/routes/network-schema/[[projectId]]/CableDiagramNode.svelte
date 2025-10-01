<script>
	// SvelteFlow
	import { Handle, Position } from '@xyflow/svelte';
	// Drawer
	import { drawerStore } from '$lib/stores/drawer';

	let { id, data } = $props();

	let handleInit = {
		top: {
			source: {
				id: `${id}-top-source`
			},
			target: {
				id: `${id}-top-target`
			}
		},
		right: {
			source: {
				id: `${id}-right-source`
			},
			target: {
				id: `${id}-right-target`
			}
		},
		bottom: {
			source: {
				id: `${id}-bottom-source`
			},
			target: {
				id: `${id}-bottom-target`
			}
		},
		left: {
			source: {
				id: `${id}-left-source`
			},
			target: {
				id: `${id}-left-target`
			}
		}
	};

	function handleNodeClick() {
		drawerStore.open({
			title: data.label || 'Node Details',
			props: {
				nodeId: id,
				nodeData: data
			}
		});
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleNodeClick();
		}
	}
</script>

<!-- Handles: top, right, bottom, left -->
<!-- Each position has overlapping source + target handles for bidirectional connections -->
<!-- Handle IDs format: {nodeUuid}-{position}-{type} -->

{#each Object.entries(handleInit) as [position, handleConfig]}
	<Handle
		type="source"
		position={Position[position.charAt(0).toUpperCase() + position.slice(1)]}
		id="{id}-{position}-source"
		style="background: var(--color-primary-500); border: 2px solid var(--color-surface-950-50); width: 12px; height: 12px;"
		isConnectable={true}
	/>
	<Handle
		type="target"
		position={Position[position.charAt(0).toUpperCase() + position.slice(1)]}
		id="{id}-{position}-target"
		style="background: var(--color-primary-500); border: 2px solid var(--color-surface-950-50); width: 12px; height: 12px;"
		isConnectable={true}
	/>
{/each}

<div
	class="w-30 h-30 flex items-center justify-center overflow-hidden border border-surface-200-700 rounded-lg shadow-md p-2 cursor-pointer hover:bg-surface-100-800 transition-colors"
	role="button"
	tabindex="0"
	onclick={handleNodeClick}
	onkeydown={handleKeydown}
	aria-label="Open node details for {data.label}"
>
	<p class="text-center break-words w-full">
		{data.label}
	</p>
</div>
