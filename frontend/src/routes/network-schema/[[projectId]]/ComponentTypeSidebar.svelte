<script>
	import { getContext, onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import {
		IconChevronLeft,
		IconChevronRight,
		IconGripVertical,
		IconMinus,
		IconPlus
	} from '@tabler/icons-svelte';

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

	/** @type {Map<number, number>} - Track quantity per component type ID */
	let quantities = $state(new Map());

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

	/**
	 * Get quantity for a component type (default 1)
	 * @param {number} ctId
	 * @returns {number}
	 */
	function getQuantity(ctId) {
		return quantities.get(ctId) || 1;
	}

	/**
	 * Update quantity for a component type
	 * @param {number} ctId
	 * @param {number} delta
	 */
	function updateQuantity(ctId, delta) {
		const current = getQuantity(ctId);
		const newValue = Math.max(1, Math.min(10, current + delta));
		quantities.set(ctId, newValue);
		quantities = new Map(quantities);
	}

	function handleDragStart(e, componentType) {
		const count = getQuantity(componentType.id);
		const isMulti = count > 1;

		e.dataTransfer.setData(
			'application/json',
			JSON.stringify({
				type: isMulti ? 'multi_component_type' : 'component_type',
				id: componentType.id,
				name: componentType.component_type,
				occupied_slots: componentType.occupied_slots,
				...(isMulti && { count, total_slots: componentType.occupied_slots * count })
			})
		);
		e.dataTransfer.effectAllowed = 'copy';

		if (dragDropManager) {
			if (isMulti) {
				dragDropManager.startMultiComponentDrag(componentType, count);
			} else {
				dragDropManager.startComponentDrag(componentType);
			}
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
			const count = getQuantity(componentType.id);
			if (dragDropManager) {
				dragDropManager.selectMobileComponent(componentType, count);
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
				{@const qty = getQuantity(ct.id)}
				<div
					class="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-200-800 border border-surface-300-700"
				>
					<button
						type="button"
						class="flex-1 flex items-center gap-3 hover:bg-surface-300-700 -m-3 p-3 rounded-lg transition-colors text-left"
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
								{ct.occupied_slots * qty} {m.form_slot({ count: ct.occupied_slots * qty })}
								{#if qty > 1}
									<span class="text-primary-500">({qty}x)</span>
								{/if}
							</div>
						</div>
					</button>
					<!-- Quantity controls -->
					<div class="flex items-center gap-1 flex-shrink-0">
						<button
							type="button"
							class="w-8 h-8 flex items-center justify-center rounded bg-surface-300-700 hover:bg-surface-400-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							onclick={(e) => {
								e.stopPropagation();
								updateQuantity(ct.id, -1);
							}}
							disabled={qty <= 1}
						>
							<IconMinus size={14} />
						</button>
						<span class="w-6 text-center text-sm font-mono">{qty}</span>
						<button
							type="button"
							class="w-8 h-8 flex items-center justify-center rounded bg-surface-300-700 hover:bg-surface-400-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							onclick={(e) => {
								e.stopPropagation();
								updateQuantity(ct.id, 1);
							}}
							disabled={qty >= 10}
						>
							<IconPlus size={14} />
						</button>
					</div>
				</div>
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
							{@const qty = getQuantity(ct.id)}
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
										{ct.occupied_slots * qty} {m.form_slot({ count: ct.occupied_slots * qty })}
										{#if qty > 1}
											<span class="text-primary-500">({qty}x)</span>
										{/if}
									</div>
								</div>
								<!-- Quantity controls -->
								<div class="flex items-center gap-0.5 flex-shrink-0">
									<button
										type="button"
										class="w-5 h-5 flex items-center justify-center rounded bg-surface-200-800 hover:bg-surface-300-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										onclick={(e) => {
											e.stopPropagation();
											updateQuantity(ct.id, -1);
										}}
										onmousedown={(e) => e.stopPropagation()}
										disabled={qty <= 1}
										draggable="false"
									>
										<IconMinus size={10} />
									</button>
									<span class="w-4 text-center text-xs font-mono">{qty}</span>
									<button
										type="button"
										class="w-5 h-5 flex items-center justify-center rounded bg-surface-200-800 hover:bg-surface-300-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										onclick={(e) => {
											e.stopPropagation();
											updateQuantity(ct.id, 1);
										}}
										onmousedown={(e) => e.stopPropagation()}
										disabled={qty >= 10}
										draggable="false"
									>
										<IconPlus size={10} />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
