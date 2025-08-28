<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';

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
		classes = 'touch-manipulation',
		zIndex = '10',
		contentBase = 'max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg',
		showToaster = true,
		onValueChange = () => {}
	} = $props();

	let isHydrating = $state(!browser);

	const toaster = createToaster({
		placement: 'bottom-end'
	});

	$effect(() => {
		if (error && browser && showToaster) {
			toaster.create({
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
</script>

{#if showToaster}
	<Toaster {toaster}></Toaster>
{/if}

{#if loading || isHydrating}
	<div class="placeholder animate-pulse {placeholderSize}"></div>
{:else if error}
	<div class="alert variant-filled-error text-sm sm:text-base">{error}</div>
{:else if data.length === 0}
	<div class="alert variant-filled-warning text-sm sm:text-base">
		{noDataMessage || 'No data available'}
	</div>
{:else}
	<Combobox
		{data}
		bind:value
		{defaultValue}
		onValueChange={handleValueChange}
		{placeholder}
		{zIndex}
		{contentBase}
		{classes}
	/>
{/if}
