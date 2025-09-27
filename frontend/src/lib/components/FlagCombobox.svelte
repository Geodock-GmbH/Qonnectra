<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';
	import { selectedFlag } from '$lib/stores/store';
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
			toaster.error({
				title: m.title_error_fetching_flags(),
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
	<div class="alert variant-filled-warning">{m.message_error_fetching_flags_no_flags()}</div>
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
		placeholder={m.placeholder_select_flag()}
		zIndex="10"
		classes="touch-manipulation"
		contentBase="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg	"
	></Combobox>
{/if}
