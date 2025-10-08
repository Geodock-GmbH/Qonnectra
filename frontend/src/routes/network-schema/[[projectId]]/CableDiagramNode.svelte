<script>
	import { parse } from 'devalue';
	// SvelteFlow
	import { Handle, Position } from '@xyflow/svelte';

	import { drawerStore } from '$lib/stores/drawer';
	import DrawerTabs from './DrawerTabs.svelte';

	let { id, data } = $props();
	let currentLabel = $state(data?.label || data?.node?.name || '');

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

	/**
	 * Handle click on node label to open node details
	 */
	async function handleNodeClick() {
		const formData = new FormData();
		formData.append('uuid', id);
		const response = await fetch('?/getNodes', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		const parsedData = typeof result.data === 'string' ? parse(result.data) : result.data;

		drawerStore.open({
			title: parsedData?.properties?.name || 'Node Details',
			component: DrawerTabs,
			props: {
				id: id,
				...parsedData.properties,
				type: 'node',
				onLabelUpdate: (newLabel) => {
					currentLabel = newLabel;
					drawerStore.setTitle(newLabel);
				}
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
	aria-label="Open node details for {currentLabel}"
>
	<p class="text-center break-words w-full">
		{currentLabel}
	</p>
</div>
