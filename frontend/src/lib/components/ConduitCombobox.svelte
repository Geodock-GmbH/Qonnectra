<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Props
	let {
		onSelect,
		placeholder = 'Search conduits...',
		conduits = [],
		conduitsError = null,
		loading = false
	} = $props();

	// State
	let selectedConduit = $state();
	let selectedConduitId = $state('');

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// Handle selection
	function handleSelection(event) {
		const selected = conduits.find((c) => c.value === event.value);
		if (selected) {
			selectedConduit = selected.meta;
			selectedConduitId = selected.value;
			onSelect?.(selected.meta);
		}
	}

	$effect(() => {
		if (conduitsError && browser) {
			toaster.create({
				type: 'error',
				message: m.error_fetching_conduits || 'Error fetching conduits',
				description: conduitsError
			});
		}
	});
</script>

<Toaster {toaster}></Toaster>

<div>
	{#if loading}
		<div class="placeholder animate-pulse w-full"></div>
	{:else if conduitsError}
		<div class="alert variant-filled-error">{conduitsError}</div>
	{:else if conduits.length === 0}
		<div class="alert variant-filled-warning">{m.no_conduits_found || 'No conduits found'}</div>
	{:else}
		<Combobox
			data={conduits}
			bind:value={selectedConduitId}
			onValueChange={handleSelection}
			{placeholder}
			classes="w-full"
		/>
	{/if}
</div>
