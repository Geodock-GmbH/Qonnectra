<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import { IconChevronLeft, IconChevronRight, IconGripVertical } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { onDragStart = () => {}, onDragEnd = () => {} } = $props();

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

	onMount(() => {
		fetchComponentTypes();
	});
</script>

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
							tabindex="0"
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

<style>
	.component-sidebar {
		position: relative;
		width: 180px;
		min-width: 180px;
		border-right: 1px solid rgb(var(--color-surface-200));
		background: rgb(var(--color-surface-50));
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
	}

	.component-sidebar.collapsed {
		width: 32px;
		min-width: 32px;
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
