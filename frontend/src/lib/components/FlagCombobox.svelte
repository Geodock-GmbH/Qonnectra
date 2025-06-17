<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { onMount } from 'svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { selectedFlag } from '$lib/stores/store';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let flags = $state([]);
	let loading = $state(true);
	let error = $state(null);

	onMount(async () => {
		try {
			const response = await fetch(`${PUBLIC_API_URL}flags/`, {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				const flagData = data.results || data;
				flags = flagData.map((f) => ({ label: f.flag, value: f.id.toString() }));
			} else {
				toaster.create({
					type: 'error',
					message: m.error_fetching_flags(),
					description: m.error_fetching_flags_description()
				});
				error = m.error_fetching_flags_description();
			}
		} catch (e) {
			error = m.error_fetching_flags_description();
			toaster.create({
				type: 'error',
				message: m.error_fetching_flags(),
				description: error || m.error_fetching_flags_description()
			});
		} finally {
			loading = false;
		}
	});
</script>

<Toaster {toaster}></Toaster>

{#if loading}
	<div class="placeholder animate-pulse"></div>
{:else if error}
	<div class="alert variant-filled-error">{error}</div>
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
