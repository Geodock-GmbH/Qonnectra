<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { selectedFlag } from '$lib/stores/store';
	import { browser } from '$app/environment';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Props - receive flags and error from parent/layout
	let { flags = [], flagsError = null, loading = false } = $props();

	// Client-side hydration loading state
	let isHydrating = $state(!browser);

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// Show error toast when there's an error
	$effect(() => {
		if (flagsError && browser) {
			toaster.create({
				type: 'error',
				message: m.error_fetching_flags(),
				description: flagsError
			});
		}
	});

	// Update hydration state
	$effect(() => {
		if (browser) {
			isHydrating = false;
		}
	});
</script>

<Toaster {toaster}></Toaster>

{#if loading || isHydrating}
	<div class="placeholder animate-pulse"></div>
{:else if flagsError}
	<div class="alert variant-filled-error">{flagsError}</div>
{:else if flags.length === 0}
	<div class="alert variant-filled-warning">{m.no_flags_available || 'No flags available'}</div>
{:else}
	<Combobox
		data={flags}
		bind:value={$selectedFlag}
		defaultValue={$selectedFlag}
		onValueChange={(e) => {
			$selectedFlag = e.value;
		}}
		placeholder={m.select_flag()}
	></Combobox>
{/if}
