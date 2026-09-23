<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { Handle, Position } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import { openFeature } from '$lib/utils/urlState';
	import { getSchemaState } from '$lib/context/networkSchemaContext';

	interface CableNodeData {
		label?: string;
		node?: { name?: string };
		[key: string]: unknown;
	}

	let { id, data, selected }: NodeProps & { data: CableNodeData } = $props();

	const schemaState = getSchemaState();

	let currentLabel = $derived(data?.label || data?.node?.name || '');

	const handleInit = $derived({
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
	});

	/** Selects the node and names it in the URL, which opens its drawer. */
	function handleNodeClick() {
		schemaState.selectNode(id);
		openFeature('node', id);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleNodeClick();
		}
	}
</script>

{#each Object.keys(handleInit) as position (position)}
	{@const positionEnum = Position as unknown as Record<string, Position>}
	{@const posKey = position.charAt(0).toUpperCase() + position.slice(1)}
	<Handle
		type="source"
		position={positionEnum[posKey]}
		id="{id}-{position}-source"
		style="background: var(--color-primary-500); border: 2px solid var(--color-surface-950-50); width: 12px; height: 12px;"
		isConnectable={true}
	/>
	<Handle
		type="target"
		position={positionEnum[posKey]}
		id="{id}-{position}-target"
		style="background: var(--color-primary-500); border: 2px solid var(--color-surface-950-50); width: 12px; height: 12px;"
		isConnectable={true}
	/>
{/each}

<div
	class="w-30 h-30 flex items-center justify-center overflow-hidden border rounded-lg shadow-md p-2 cursor-pointer hover:bg-surface-100-800 transition-colors"
	class:border-primary-500={selected}
	class:border-2={selected}
	role="button"
	tabindex="0"
	onclick={handleNodeClick}
	onkeydown={handleKeydown}
	aria-label={m.tooltip_open_node_details({ label: currentLabel })}
>
	<p class="text-center wrap-break-word w-full">
		{currentLabel}
	</p>
</div>
