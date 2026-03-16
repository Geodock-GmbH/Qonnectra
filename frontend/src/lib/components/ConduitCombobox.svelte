<script>
	import { browser } from '$app/environment';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';
	import VirtualCombobox from '$lib/components/VirtualCombobox.svelte';
	import { selectedConduit } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	let {
		loading = false,
		projectId = null,
		flagId = null,
		conduits = [],
		conduitsError = null
	} = $props();

	$effect(() => {
		if (conduitsError && browser) {
			globalToaster.error({
				title: m.title_error_fetching_conduits(),
				description: conduitsError
			});
		}
	});

	$effect(() => {
		if (browser && conduits.length > 0 && $selectedConduit) {
			const currentValue = Array.isArray($selectedConduit) ? $selectedConduit[0] : $selectedConduit;
			const exists = conduits.some((c) => c.value === currentValue);
			if (!exists) {
				$selectedConduit = undefined;
			}
		}
	});
</script>

<div>
	{#if loading}
		<div class="placeholder animate-pulse"></div>
	{:else if conduitsError}
		<div class="text-error-500 p-2">{conduitsError}</div>
	{:else if conduits.length === 0 && (projectId || flagId)}
		<GenericCombobox data={[]} value={[]} noDataMessage={m.message_no_conduits_found()} />
	{:else}
		<VirtualCombobox
			data={conduits}
			value={$selectedConduit ?? ''}
			onValueChange={(/** @type {{ value: string }} */ e) => ($selectedConduit = e.value)}
			placeholder={m.placeholder_select_conduit()}
		/>
	{/if}
</div>
