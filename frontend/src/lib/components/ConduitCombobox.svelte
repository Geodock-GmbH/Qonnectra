<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { selectedConduit, selectedFlag } from '$lib/stores/store';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Props
	let { projectId = null, flagId = null } = $props();

	// Client-side hydration loading state
	let isHydrating = $state(!browser);

	// State
	let conduits = $state([]);
	let conduitsError = $state(null);
	let loading = $state(false);

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	async function fetchConduits() {
		if (!projectId || !flagId) {
			conduitsError = m.select_project_and_flag_first();
			return;
		}

		loading = true;
		conduitsError = null;

		try {
			const response = await fetch(
				`${PUBLIC_API_URL}conduit/?project=${projectId}&flag=${flagId}`,
				{ credentials: 'include' }
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			conduits = data.results.map((item) => ({
				value: item.uuid,
				label: item.name
			}));
		} catch (error) {
			conduitsError = m.error_fetching_conduits();
		} finally {
			loading = false;
		}
	}

	// Fetch conduits when projectId or flagId changes
	$effect(() => {
		if (browser && projectId && flagId) {
			fetchConduits();
		}
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

	// Update hydration state
	$effect(() => {
		if (browser) {
			isHydrating = false;
		}
	});
</script>

<Toaster {toaster}></Toaster>

<div>
	{#if loading}
		<div class="placeholder animate-pulse"></div>
	{:else if conduits.length === 0}
		<select class="select">
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
		/>
	{/if}
</div>
