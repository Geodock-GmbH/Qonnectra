<script>
	// Skeleton
	import { Combobox } from '@skeletonlabs/skeleton-svelte';
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

	// Show error toast
	$effect(() => {
		if (conduitsError && browser) {
			globalToaster.error({
				title: m.title_error_fetching_conduits(),
				description: conduitsError
			});
		}
	});
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
			data={conduits}
			bind:value={$selectedConduit}
			defaultValue={$selectedConduit}
			onValueChange={(e) => ($selectedConduit = e.value)}
			placeholder={m.placeholder_select_conduit()}
			zIndex="10"
			classes="touch-manipulation"
			contentBase="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
		/>
	{/if}
</div>
