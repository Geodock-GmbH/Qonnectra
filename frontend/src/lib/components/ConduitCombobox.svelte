<script>
	import { browser } from '$app/environment';
	import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import { selectedConduit } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	let {
		loading = false,
		projectId = null,
		flagId = null,
		conduits = [],
		conduitsError = null
	} = $props();

	const collection = $derived(
		useListCollection({
			items: conduits,
			itemToString: (item) => item?.label ?? '',
			itemToValue: (item) => item?.value ?? ''
		})
	);

	let items = $derived(collection.items);
	let isOpen = $state(false);

	$effect(() => {
		if (conduitsError && browser) {
			globalToaster.error({
				title: m.title_error_fetching_conduits(),
				description: conduitsError
			});
		}
	});

	$effect(() => {
		if (isOpen) {
			items = conduits;
		}
	});

	function handleValueChange(e) {
		$selectedConduit = e.value;
	}

	function handleOpenChange(e) {
		isOpen = e.open;
	}

	const onInputValueChange = (e) => {
		const filtered = conduits.filter((item) =>
			item.label.toLowerCase().includes(e.inputValue.toLowerCase())
		);
		if (filtered.length > 0) {
			items = filtered;
		} else {
			items = conduits;
		}
	};
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
			onOpenChange={handleOpenChange}
			{onInputValueChange}
		>
			<Combobox.Control>
				<Combobox.Input />
				<Combobox.Trigger />
			</Combobox.Control>
			<Portal>
				<Combobox.Positioner class="z-10">
					<Combobox.Content
						class="z-50 max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
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
