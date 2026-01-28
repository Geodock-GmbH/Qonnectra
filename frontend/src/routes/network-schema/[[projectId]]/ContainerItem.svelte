<script>
	import { flip } from 'svelte/animate';
	import {
		IconChevronDown,
		IconChevronRight,
		IconGripVertical,
		IconTrash
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import Self from './ContainerItem.svelte';
	import SlotConfigItem from './SlotConfigItem.svelte';

	let {
		container,
		depth = 0,
		onDelete,
		onMove,
		onToggleExpand,
		onEditSlotConfig,
		onDeleteSlotConfig,
		onViewStructure
	} = $props();

	let dragOver = $state(false);

	function handleDragStart(e) {
		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: 'container',
				uuid: container.uuid
			})
		);
		e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(e) {
		e.preventDefault();
		const hasData = e.dataTransfer.types.includes('application/json');
		if (hasData) {
			dragOver = true;
			e.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			dragOver = false;
		}
	}

	function handleDrop(e) {
		e.preventDefault();
		e.stopPropagation();
		dragOver = false;

		try {
			const data = JSON.parse(e.dataTransfer.getData('application/json'));
			if (data.type === 'container' && data.uuid === container.uuid) {
				return;
			}
			onMove?.(data, container.uuid);
		} catch (err) {
			console.error('Drop error:', err);
		}
	}

	function toggleExpand() {
		onToggleExpand?.(container.uuid);
	}

	const hasChildren = $derived(
		container.children?.length > 0 || container.slot_configurations?.length > 0
	);

	const paddingLeft = $derived(`${depth * 1.5}rem`);
</script>

<div class="container-item" class:drag-over={dragOver} style:padding-left={paddingLeft}>
	<div
		class="flex items-center gap-2 m-1 p-2 bg-(--color-surface-200-800) border-b border-(--color-surface-300-700) rounded border"
		draggable="true"
		ondragstart={handleDragStart}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		role="treeitem"
		aria-selected="false"
		aria-expanded={container.is_expanded}
		tabindex="0"
	>
		<IconGripVertical size={16} class="cursor-grab text-surface-400 shrink-0" />

		{#if hasChildren}
			<button
				type="button"
				class="p-0.5 hover:bg-surface-200-800 rounded shrink-0"
				onclick={toggleExpand}
			>
				{#if container.is_expanded}
					<IconChevronDown size={16} />
				{:else}
					<IconChevronRight size={16} />
				{/if}
			</button>
		{:else}
			<span class="w-5 shrink-0"></span>
		{/if}

		<span class="flex-1 font-medium text-sm truncate">
			{container.display_name}
		</span>

		<button
			type="button"
			class="btn btn-sm preset-filled-error-500 p-1.5 shrink-0"
			onclick={() => onDelete?.(container.uuid)}
			title={m.common_delete()}
		>
			<IconTrash size={14} />
		</button>
	</div>

	{#if container.is_expanded && hasChildren}
		<div class="children mt-1 space-y-1">
			<!-- Slot configurations first -->
			{#each container.slot_configurations || [] as config (config.uuid)}
				<div animate:flip={{ duration: 200 }}>
					<SlotConfigItem
						{config}
						depth={depth + 1}
						onEdit={onEditSlotConfig}
						onDelete={onDeleteSlotConfig}
						{onViewStructure}
					/>
				</div>
			{/each}

			<!-- Child containers after slot configs -->
			{#each container.children || [] as child (child.uuid)}
				<div animate:flip={{ duration: 200 }}>
					<Self
						container={child}
						depth={depth + 1}
						{onDelete}
						{onMove}
						{onToggleExpand}
						{onEditSlotConfig}
						{onDeleteSlotConfig}
						{onViewStructure}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.container-item {
		transition: background-color 0.15s ease;
	}

	.container-item.drag-over > div:first-child {
		background-color: rgba(59, 130, 246, 0.15);
		border-color: rgb(59, 130, 246);
	}
</style>
