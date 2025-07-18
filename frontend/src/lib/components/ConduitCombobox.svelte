<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';
	import { selectedConduit } from '$lib/stores/store';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let {
		loading = false,
		projectId = null,
		flagId = null,
		conduits = [],
		conduitsError = null
	} = $props();

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	// Show error toast
	$effect(() => {
		if (conduitsError && browser) {
			toaster.create({
				type: 'error',
				message: m.error_fetching_conduits(),
				description: conduitsError
			});
		}
	});
</script>

<Toaster {toaster}></Toaster>

<div>
	{#if loading}
		<div class="placeholder animate-pulse"></div>
	{:else if conduitsError}
		<div class="text-error-500 p-2">{conduitsError}</div>
	{:else if conduits.length === 0 && (projectId || flagId)}
		<select class="select" disabled>
			<option value="">{m.no_conduits_found()}</option>
		</select>
	{:else}
		<Combobox
			data={conduits}
			bind:value={$selectedConduit}
			defaultValue={$selectedConduit}
			onValueChange={(e) => ($selectedConduit = e.value)}
			placeholder={m.select_conduit()}
			zIndex="10"
			classes="touch-manipulation"
			contentBase="max-h-60 overflow-auto touch-manipulation"
		/>
	{/if}
</div>
