<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';
	import { selectedFlag, selectedProject } from '$lib/stores/store';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let { flags = [], flagsError = null, loading = false, onchange = (_) => {} } = $props();

	// Client-side hydration loading state
	let isHydrating = $state(!browser);

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

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

<!-- Loading -->
{#if loading || isHydrating}
	<div class="placeholder animate-pulse"></div>
{:else if flagsError}
	<div class="alert variant-filled-error">{flagsError}</div>
{:else if flags.length === 0}
	<div class="alert variant-filled-warning">{m.error_fetching_flags_no_flags()}</div>
{:else}
	<!-- FlagCombobox -->
	<Combobox
		data={flags}
		bind:value={$selectedFlag}
		defaultValue={$selectedFlag}
		onValueChange={(e) => {
			$selectedFlag = e.value;
			onchange(e);
		}}
		placeholder={m.select_flag()}
		zIndex="10"
	></Combobox>
{/if}
