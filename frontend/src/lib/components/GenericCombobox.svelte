<script>
	import { browser } from '$app/environment';
	import { Combobox, useListCollection } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	let {
		data = [],
		value = $bindable(),
		defaultValue = [],
		placeholder = '',
		error = null,
		errorMessage = '',
		noDataMessage = '',
		loading = false,
		placeholderSize = 'size-10',
		classes = 'touch-manipulation w-full',
		zIndex = '10',
		contentBase = 'max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 preset-filled-surface-50-950 shadow-lg',
		inputClasses = '',
		onValueChange = () => {}
	} = $props();

	let isOpen = $state(false);

	let isHydrating = $state(!browser);

	const collection = $derived(
		useListCollection({
			items: data,
			itemToString: (item) => item?.label ?? '',
			itemToValue: (item) => item?.value ?? ''
		})
	);

	let items = $derived(collection.items);

	const onInputValueChange = (e) => {
		const filtered = data.filter((item) =>
			item.label.toLowerCase().includes(e.inputValue.toLowerCase())
		);
		if (filtered.length > 0) {
			items = filtered;
		} else {
			items = data;
		}
	};

	$effect(() => {
		if (isOpen) {
			items = data;
		}
	});

	$effect(() => {
		if (error && browser) {
			globalToaster.error({
				title: error || m.common_error(),
				description: errorMessage
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

	function handleOpenChange(e) {
		isOpen = e.open;
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
		bind:value
		onOpenChange={handleOpenChange}
		onValueChange={handleValueChange}
		{onInputValueChange}
	>
		<Combobox.Control>
			<Combobox.Input class="placeholder:text-sm placeholder:truncate {inputClasses}" />
			<Combobox.Trigger />
		</Combobox.Control>
		<Combobox.Positioner>
			<Combobox.Content class="{contentBase} {isOpen ? 'z-[100]' : `z-${zIndex}`}">
				{#each items as item (item.value)}
					<Combobox.Item {item} class="text-surface-800-200">
						<Combobox.ItemText class="text-surface-800-200">{item.label}</Combobox.ItemText>
						<Combobox.ItemIndicator />
					</Combobox.Item>
				{/each}
			</Combobox.Content>
		</Combobox.Positioner>
	</Combobox>
{/if}
