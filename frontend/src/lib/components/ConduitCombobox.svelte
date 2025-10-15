<script>
	// Skeleton
	import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
	// Svelte
	import { browser } from '$app/environment';
	import { selectedConduit } from '$lib/stores/store';
	// Paraglide
	import { m } from '$lib/paraglide/messages';
	import { globalToaster } from '$lib/stores/toaster';

	let {
		loading = false,
		projectId = null,
		flagId = null,
		conduits = [],
		conduitsError = null
	} = $props();

	// Create collection from conduits
	const collection = $derived(
		useListCollection({
			items: conduits,
			itemToString: (item) => item?.label ?? '',
			itemToValue: (item) => item?.value ?? ''
		})
	);

	// Get items from collection for rendering
	const items = $derived(collection.items);

	// Show error toast
	$effect(() => {
		if (conduitsError && browser) {
			globalToaster.error({
				title: m.title_error_fetching_conduits(),
				description: conduitsError
			});
		}
	});

	function handleValueChange(e) {
		$selectedConduit = e.value;
	}
</script>

<div>
	{#if loading}
		<div class="placeholder animate-pulse"></div>
	{:else if conduitsError}
		<div class="text-error-500 p-2">{conduitsError}</div>
	{:else if conduits.length === 0 && (projectId || flagId)}
		<select class="select" disabled>
			<option value="">{m.message_no_conduits_found()}</option>
		</select>
	{:else}
		<Combobox
			class="touch-manipulation w-full"
			placeholder={m.placeholder_select_conduit()}
			{collection}
			defaultValue={$selectedConduit}
			onValueChange={handleValueChange}
		>
			<Combobox.Control>
				<Combobox.Input />
				<Combobox.Trigger />
			</Combobox.Control>
			<Portal>
				<Combobox.Positioner class="z-10">
					<Combobox.Content
						class="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
					>
						{#each items as item (item.value)}
							<Combobox.Item {item}>
								<Combobox.ItemText>{item.label}</Combobox.ItemText>
								<Combobox.ItemIndicator />
							</Combobox.Item>
						{/each}
					</Combobox.Content>
				</Combobox.Positioner>
			</Portal>
		</Combobox>
	{/if}
</div>
