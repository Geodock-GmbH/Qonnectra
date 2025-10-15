<script>
	// Skeleton
	import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
	// Svelte
	import { browser } from '$app/environment';
	import { globalToaster } from '$lib/stores/toaster';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let {
		data = [],
		value = $bindable(),
		defaultValue = '',
		placeholder = '',
		error = null,
		errorMessage = '',
		noDataMessage = '',
		loading = false,
		placeholderSize = 'size-10',
		classes = 'touch-manipulation w-full',
		zIndex = '10',
		contentBase = 'max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg',
		onValueChange = () => {},
		itemToString = (item) => item?.label ?? '',
		itemToValue = (item) => item?.value ?? ''
	} = $props();

	let isHydrating = $state(!browser);
	let filteredItems = $state(data);

	// Create collection from data
	const collection = $derived(
		useListCollection({
			items: filteredItems,
			itemToString,
			itemToValue
		})
	);

	// Get items from collection for rendering
	const items = $derived(collection.items);

	// Update filtered items when data changes
	$effect(() => {
		filteredItems = data;
	});

	$effect(() => {
		if (error && browser) {
			globalToaster.error({
				type: 'error',
				message: errorMessage || 'Error loading data',
				description: error
			});
		}
	});

	$effect(() => {
		if (browser) {
			isHydrating = false;
		}
	});

	function handleValueChange(e) {
		value = e.value;
		onValueChange(e);
	}

	function handleInputValueChange(e) {
		const inputValue = e.inputValue.toLowerCase();
		const filtered = data.filter((item) => {
			const itemString = itemToString(item).toLowerCase();
			return itemString.includes(inputValue);
		});
		filteredItems = filtered.length > 0 ? filtered : data;
	}

	function handleOpenChange() {
		// Reset filtered items when opening
		filteredItems = data;
	}
</script>

{#if loading || isHydrating}
	<div class="placeholder animate-pulse {placeholderSize}"></div>
{:else if error}
	<div class="alert variant-filled-error text-sm sm:text-base">{error}</div>
{:else if data.length === 0}
	<div class="alert variant-filled-warning text-sm sm:text-base">
		{noDataMessage || m.form_no_data_available()}
	</div>
{:else}
	<Combobox
		class={classes}
		{placeholder}
		{collection}
		{defaultValue}
		{value}
		onValueChange={handleValueChange}
		onInputValueChange={handleInputValueChange}
		onOpenChange={handleOpenChange}
	>
		<Combobox.Control>
			<Combobox.Input />
			<Combobox.Trigger />
		</Combobox.Control>
		<Portal>
			<Combobox.Positioner class="z-{zIndex}">
				<Combobox.Content class={contentBase}>
					{#each items as item (itemToValue(item))}
						<Combobox.Item {item}>
							<Combobox.ItemText>{itemToString(item)}</Combobox.ItemText>
							<Combobox.ItemIndicator />
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Positioner>
		</Portal>
	</Combobox>
{/if}
