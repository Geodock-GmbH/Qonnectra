<script lang="ts">
	import type { NodeProps } from '@xyflow/svelte';
	import { Handle, Position } from '@xyflow/svelte';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { getSchemaState } from '$lib/context/networkSchemaContext';

	import DrawerTabs from './DrawerTabs.svelte';

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

	/**
	 * Handle click on node label to open node details
	 */
	async function handleNodeClick() {
		schemaState.selectNode(id);

		try {
			const parsedData = await schemaState.loadNodeDetails(id);
			const properties = (parsedData?.properties ?? {}) as Record<string, unknown>;

			drawerStore.open({
				title: (properties.name as string) || m.title_node_details(),
				component: DrawerTabs,
				props: {
					id: id,
					...properties,
					type: 'node',
					onLabelUpdate: (newLabel: string) => {
						drawerStore.setTitle(newLabel);
						schemaState.updateNodeName(id, newLabel);
					},
					onNodeDelete: (nodeId: string) => schemaState.handleNodeDelete(nodeId)
				}
			});
		} catch (error) {
			console.error('Failed to load node details:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Failed to load node details',
				extraData: {
					from: 'CableDiagramNode.handleNodeClick',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_loading_node_details()
			});
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleNodeClick();
		}
	}
</script>

{#each Object.entries(handleInit) as [position, handleConfig]}
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
