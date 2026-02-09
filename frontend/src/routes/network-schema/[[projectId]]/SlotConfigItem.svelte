<script>
	import { IconEye, IconGripVertical, IconPencil, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { config, depth = 0, onEdit, onDelete, onDragStart, onViewStructure } = $props();

	function handleDragStart(e) {
		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: 'slot_configuration',
				uuid: config.uuid
			})
		);
		e.dataTransfer.effectAllowed = 'move';
		onDragStart?.();
	}

	const paddingLeft = $derived(`${depth * 1.5}rem`);
</script>

<div
	class="slot-config-item"
	style:padding-left={paddingLeft}
	draggable="true"
	ondragstart={handleDragStart}
	role="treeitem"
	aria-selected="false"
	tabindex="0"
>
	<div
		class="flex items-center gap-2 m-1 p-2 bg-surface-50-950 rounded border border-surface-200-800"
	>
		<IconGripVertical size={16} class="cursor-grab text-surface-400 shrink-0" />

		<div class="flex-1 min-w-0">
			<div class="font-medium text-sm truncate">{config.side}</div>
			<div class="text-xs text-surface-950-50">
				{m.form_total_slots()}: {config.total_slots} |
				{m.form_used_slots()}: {config.used_slots ?? 0} |
				{m.form_free_slots()}: {config.free_slots ?? config.total_slots}
			</div>
		</div>

		<div class="flex items-center gap-1 shrink-0">
			<button
				type="button"
				class="btn btn-sm preset-filled-secondary-500 p-1.5"
				onclick={() => onViewStructure?.(config.uuid)}
				title={m.action_view_structure()}
			>
				<IconEye size={14} />
			</button>

			<button
				type="button"
				class="btn btn-sm preset-filled-warning-500 p-1.5"
				onclick={() => onEdit?.(config)}
				title={m.common_edit()}
			>
				<IconPencil size={14} />
			</button>

			<button
				type="button"
				class="btn btn-sm preset-filled-error-500 p-1.5"
				onclick={() => onDelete?.(config.uuid)}
				title={m.common_delete()}
			>
				<IconTrash size={14} />
			</button>
		</div>
	</div>
</div>

<style>
	.slot-config-item {
		transition: opacity 0.15s ease;
	}

	.slot-config-item:global(.dragging) {
		opacity: 0.5;
	}
</style>
