<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { Panel } from '@xyflow/svelte';
	import { IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { getSchemaState } from '$lib/context/networkSchemaContext';

	const schemaState = getSchemaState();

	/** Below Tailwind's `md` breakpoint the top-left attributes panel spans the canvas width and would cover a top-right badge. */
	const mobile = new MediaQuery('max-width: 767px', false);

	/** Human-readable name of the cable currently in edit mode. */
	let editingCableName = $derived.by(() => {
		const id = schemaState.editingCableId;
		if (!id) return '';
		const edge = schemaState.edges.find((e) => e.id === id);
		const data = edge?.data as { label?: string; cable?: { name?: string } } | undefined;
		return data?.label || data?.cable?.name || '';
	});
</script>

{#if schemaState.editingCableId}
	<!-- On mobile the badge sits between the zoom controls (bottom-left) and the attribution (bottom-right). -->
	<Panel
		position={mobile.current ? 'bottom-center' : 'top-right'}
		class={mobile.current ? 'w-max max-w-[calc(100%-8rem)]' : undefined}
	>
		<div
			class="card bg-primary-50-950 border border-primary-500 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2"
		>
			<span class="text-sm font-medium text-primary-900-100 truncate min-w-0">
				{m.label_editing_cable({ name: editingCableName })}
			</span>
			<button
				type="button"
				class="btn-icon btn-icon-sm hover:bg-primary-100-900 rounded shrink-0"
				title={m.tooltip_exit_edit_mode()}
				aria-label={m.tooltip_exit_edit_mode()}
				onclick={() => schemaState.exitEditMode()}
			>
				<IconX size={16} />
			</button>
		</div>
	</Panel>
{/if}
