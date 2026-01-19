<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { IconChevronLeft, IconChevronRight, IconGripVertical } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let {
		onDragStart = () => {},
		onDragEnd = () => {},
		isMobile = false,
		onMobileSelect = () => {}
	} = $props();

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
		onDragStart(componentType);
	}

	function handleDragEnd() {
		onDragEnd();
	}

	function handleItemClick(componentType) {
		if (isMobile) {
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
	<div class="component-sidebar" class:collapsed>
		<button
			type="button"
			class="toggle-btn"
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
			<div class="sidebar-content">
				<h3 class="text-sm font-semibold mb-2 px-2">{m.form_component_types()}</h3>

				{#if loading}
					<div class="text-center py-4 text-surface-500">{m.common_loading()}</div>
				{:else if componentTypes.length === 0}
					<div class="text-center py-4 text-surface-500">{m.message_no_component_types()}</div>
				{:else}
					<div class="space-y-1">
						{#each componentTypes as ct (ct.id)}
							<div
								class="component-item"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, ct)}
								ondragend={handleDragEnd}
								role="listitem"
							>
								<IconGripVertical size={14} class="text-surface-400 flex-shrink-0" />
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium truncate">{ct.component_type}</div>
									<div class="text-xs text-surface-500">
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

<style>
	.component-sidebar {
		position: relative;
		width: 200px;
		min-width: 200px;
		border-right: 1px solid rgb(var(--color-surface-200));
		background: rgb(var(--color-surface-50));
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
	}

	:global([data-mode='dark']) .component-sidebar {
		border-right-color: rgb(var(--color-surface-700));
		background: rgb(var(--color-surface-900));
	}

	.component-sidebar.collapsed {
		width: 40px;
		min-width: 40px;
	}

	.toggle-btn {
		position: absolute;
		top: 8px;
		right: -12px;
		z-index: 10;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.toggle-btn:hover {
		background: rgb(var(--color-surface-200));
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 4px;
	}

	.component-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		margin: 0 4px;
		border-radius: 4px;
		background: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-200));
		cursor: grab;
		transition:
			background-color 0.15s,
			border-color 0.15s;
	}

	.component-item:hover {
		background: rgb(var(--color-surface-200));
		border-color: rgb(var(--color-primary-500));
	}

	.component-item:active {
		cursor: grabbing;
	}
</style>
