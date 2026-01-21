<script>
	import { getContext, onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { IconChevronLeft, IconChevronRight, IconGripVertical } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { DRAG_DROP_CONTEXT_KEY } from '$lib/classes/DragDropManager.svelte.js';

	let {
		onDragStart = () => {},
		onDragEnd = () => {},
		isMobile = false,
		onMobileSelect = () => {}
	} = $props();

	const dragDropManager = getContext(DRAG_DROP_CONTEXT_KEY);

	let componentTypes = $state([]);
	let loading = $state(true);
	let collapsed = $state(false);

	async function fetchComponentTypes() {
		loading = true;
		try {
			const formData = new FormData();
			const response = await fetch('?/getComponentTypes', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				componentTypes = result.data?.componentTypes || [];
			}
		} catch (err) {
			console.error('Error fetching component types:', err);
		} finally {
			loading = false;
		}
	}

	function handleDragStart(e, componentType) {
		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: 'component_type',
				id: componentType.id,
				name: componentType.component_type,
				occupied_slots: componentType.occupied_slots
			})
		);
		e.dataTransfer.effectAllowed = 'copy';

		if (dragDropManager) {
			dragDropManager.startComponentDrag(componentType);
		}
		onDragStart(componentType);
	}

	function handleDragEnd() {
		if (dragDropManager) {
			dragDropManager.endDrag();
		}
		onDragEnd();
	}

	function handleItemClick(componentType) {
		if (isMobile) {
			if (dragDropManager) {
				dragDropManager.selectMobileComponent(componentType);
			}
			onMobileSelect(componentType);
		}
	}

	onMount(() => {
		fetchComponentTypes();
	});
</script>

{#if isMobile}
	<!-- Mobile: Simple list without sidebar wrapper -->
	<div class="space-y-2">
		{#if loading}
			<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
		{:else if componentTypes.length === 0}
			<div class="text-center py-4 text-surface-500">{m.message_no_component_types()}</div>
		{:else}
			{#each componentTypes as ct (ct.id)}
				<button
					type="button"
					class="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-200-800 hover:bg-surface-300-700 border border-surface-300-700 transition-colors text-left"
					onclick={() => handleItemClick(ct)}
				>
					<div
						class="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0"
					>
						<IconGripVertical size={20} class="text-primary-500" />
					</div>
					<div class="flex-1 min-w-0">
						<div class="font-medium truncate">{ct.component_type}</div>
						<div class="text-sm text-surface-500">
							{ct.occupied_slots}
							{ct.occupied_slots === 1 ? 'slot' : 'slots'}
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
{:else}
	<!-- Desktop: Original sidebar -->
	<div
		class="relative border-r border-[var(--color-surface-200-800)] bg-[var(--color-surface-100-900)] transition-all duration-200 ease-in-out flex flex-col"
		style:width={collapsed ? '40px' : '200px'}
		style:min-width={collapsed ? '40px' : '200px'}
	>
		<button
			type="button"
			class="absolute top-2 -right-3 z-10 w-6 h-6 rounded-full bg-[var(--color-surface-100-900)] border border-[var(--color-surface-300-700)] flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-200-800)]"
			onclick={() => (collapsed = !collapsed)}
			title={collapsed ? m.action_expand() : m.action_collapse()}
		>
			{#if collapsed}
				<IconChevronRight size={16} />
			{:else}
				<IconChevronLeft size={16} />
			{/if}
		</button>

		{#if !collapsed}
			<div class="flex-1 overflow-y-auto p-2 px-1">
				<h3 class="text-sm font-semibold mb-2 px-2">{m.form_component_types()}</h3>

				{#if loading}
					<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
				{:else if componentTypes.length === 0}
					<div class="text-center py-4 text-surface-500">{m.message_no_component_types()}</div>
				{:else}
					<div class="space-y-1">
						{#each componentTypes as ct (ct.id)}
							<div
								class="flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded bg-[var(--color-surface-100-900)] border border-[var(--color-surface-200-800)] cursor-grab transition-colors duration-150 hover:bg-[var(--color-surface-200-800)] hover:border-[var(--color-primary-500)] active:cursor-grabbing"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, ct)}
								ondragend={handleDragEnd}
								role="listitem"
							>
								<IconGripVertical size={14} class="text-surface-400 flex-shrink-0" />
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium truncate">{ct.component_type}</div>
									<div class="text-xs text-surface-950-50">
										{ct.occupied_slots}
										{ct.occupied_slots === 1 ? 'slot' : 'slots'}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
