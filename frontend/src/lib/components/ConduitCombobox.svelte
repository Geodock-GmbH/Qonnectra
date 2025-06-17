<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';
	import { PUBLIC_API_URL } from '$env/static/public';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Props
	let { onSelect, placeholder = m.select_conduit(), projectId = null, flagId = null } = $props();

	// State
	let selectedConduit = $state();
	let selectedConduitId = $state('');
	let conduits = $state([]);
	let conduitsError = $state(null);
	let loading = $state(false);

	// Client-side hydration loading state
	let isHydrating = $state(!browser);

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

	// Fetch conduits from API
	async function fetchConduits() {
		if (!projectId || !flagId) {
			conduitsError = m.select_project_and_flag_first || 'Please select project and flag first';
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

			conduits = data.results.map((conduit) => ({
				value: conduit.uuid,
				label: conduit.name,
				meta: conduit
			}));
		} catch (error) {
			console.error('Error fetching conduits:', error);
			conduitsError = error.message || 'Unknown error occurred';
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
	{#if loading || isHydrating}
		<div class="placeholder animate-pulse w-full"></div>
	{:else if conduitsError}
		<div class="select">{m.error_fetching_conduits()}</div>
	{:else if conduits.length === 0}
		<select class="select">
			<option value="">{m.no_conduits_found()}</option>
		</select>
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
