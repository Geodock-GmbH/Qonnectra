<script>
	import { Handle, Position } from '@xyflow/svelte';
	import { parse } from 'devalue';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore } from '$lib/stores/drawer';

	import DrawerTabs from './DrawerTabs.svelte';

	let { id, data, selected } = $props();

	let currentLabel = $state('');

	$effect(() => {
		currentLabel = data?.label || data?.node?.name || '';
	});

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

	/**
	 * Handle click on node label to open node details
	 */
	async function handleNodeClick() {
		if (data?.onNodeSelect) {
			data.onNodeSelect(id);
		}

		const formData = new FormData();
		formData.append('uuid', id);
		const response = await fetch('?/getNodes', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		const parsedData = typeof result.data === 'string' ? parse(result.data) : result.data;

		drawerStore.open({
			title: parsedData?.properties?.name || m.title_node_details(),
			component: DrawerTabs,
			props: {
				id: id,
				...parsedData.properties,
				type: 'node',
				onLabelUpdate: (/** @type {any} */ newLabel) => {
					currentLabel = newLabel;
					drawerStore.setTitle(newLabel);
					data?.onNameUpdate?.(newLabel);
				},
				onNodeDelete: data?.onNodeDelete
			}
		});
	}

	function handleKeydown(/** @type {any} */ event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleNodeClick();
		}
	}
</script>

{#each Object.entries(handleInit) as [position, handleConfig]}
	{@const positionEnum = /** @type {Record<string, any>} */ (Position)}
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
