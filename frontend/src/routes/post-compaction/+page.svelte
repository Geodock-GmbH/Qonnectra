<script>
	import { get } from 'svelte/store';
	import { slide } from 'svelte/transition';
	import { deserialize } from '$app/forms';
	import { IconLoader2, IconMapPin, IconSearch, IconX } from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import ExportDialog from './ExportDialog.svelte';

	/** @type {import('./$types').PageProps} */
	let { data } = $props();

	const statusDevelopments = $derived(data.statusDevelopments);

	let searchQuery = $state('');
	/** @type {Record<string, any>[]} */
	let searchResults = $state([]);
	let searching = $state(false);
	/** @type {ReturnType<typeof setTimeout> | null} */
	let searchTimeout = null;

	/** @type {Record<string, any> | null} */
	let selectedAddress = $state(null);
	/** @type {Record<string, any>[]} */
	let residentialUnits = $state([]);
	/** @type {Record<string, any>[]} */
	let linkedMicroducts = $state([]);
	let loadingAddress = $state(false);
	let exportDialogOpen = $state(false);

	/**
	 * Searches for addresses via the trace-search API.
	 * @param {string} query - Search string (minimum 2 characters).
	 */
	async function performSearch(query) {
		if (!query || query.length < 2) {
			searchResults = [];
			return;
		}

		searching = true;
		try {
			const params = new URLSearchParams({
				search: query,
				type: 'address',
				project: get(selectedProject)
			});

			const response = await fetch(`${PUBLIC_API_URL}trace-search/?${params}`, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Search failed');

			const data = await response.json();
			searchResults = data.results || [];
		} catch (err) {
			console.error('Search error:', err);
			searchResults = [];
		} finally {
			searching = false;
		}
	}

	/**
	 * Debounces search input and triggers a search after 300ms.
	 * @param {Event & { currentTarget: HTMLInputElement }} e
	 */
	function handleSearchInput(e) {
		const query = e.currentTarget.value;
		searchQuery = query;

		if (searchTimeout) clearTimeout(searchTimeout);

		searchTimeout = setTimeout(() => {
			performSearch(query);
		}, 300);
	}

	/**
	 * Formats an address search result for display.
	 * @param {Record<string, any>} result
	 * @returns {string}
	 */
	function formatAddressResult(result) {
		const parts = [];
		if (result.street) parts.push(result.street);
		if (result.housenumber) parts.push(result.housenumber + (result.house_number_suffix || ''));
		if (result.zip_code || result.city) {
			parts.push(`${result.zip_code || ''} ${result.city || ''}`.trim());
		}
		return parts.join(', ') || result.uuid?.slice(0, 8);
	}

	/**
	 * Fetches full address and residential units via server action.
	 * @param {Record<string, any>} result
	 */
	async function selectAddress(result) {
		loadingAddress = true;
		searchResults = [];
		searchQuery = '';

		try {
			const formData = new FormData();
			formData.append('uuid', result.uuid);

			const response = await fetch('?/fetchAddress', {
				method: 'POST',
				body: formData
			});

			const actionResult = deserialize(await response.text());

			if (actionResult.type === 'success') {
				const resultData = /** @type {any} */ (actionResult.data);
				selectedAddress = resultData.address;
				residentialUnits = resultData.residentialUnits || [];
				linkedMicroducts = resultData.linkedMicroducts || [];
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: /** @type {any} */ (actionResult).data?.message || 'Failed to fetch address'
				});
			}
		} catch (error) {
			console.error('Error fetching address:', error);
			globalToaster.error({
				title: m.common_error(),
				description: 'Failed to fetch address'
			});
		} finally {
			loadingAddress = false;
		}
	}

	function clearSelection() {
		selectedAddress = null;
		residentialUnits = [];
		linkedMicroducts = [];
		searchQuery = '';
		searchResults = [];
	}
</script>

<svelte:head>
	<title>{m.nav_post_compaction()}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="card p-4 sm:p-6">
		<div class="flex items-center gap-3 mb-4">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold">{m.nav_post_compaction()}</h1>
				<p class="text-sm text-surface-600-400">{m.pc_description()}</p>
			</div>
		</div>

		{#if !selectedAddress}
			<div class="relative">
				<IconSearch
					size={20}
					class="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500-400"
				/>
				<input
					type="text"
					value={searchQuery}
					oninput={handleSearchInput}
					placeholder={m.pc_search_placeholder()}
					autocomplete="off"
					spellcheck="false"
					class="w-full rounded-lg border border-surface-200-800 bg-transparent py-3 pl-12 pr-4 text-surface-900-100 placeholder:text-surface-500-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
				/>
				{#if searching}
					<IconLoader2
						size={20}
						class="absolute right-4 top-1/2 -translate-y-1/2 text-primary-500 animate-spin"
					/>
				{/if}
			</div>

			{#if searchResults.length > 0}
				<div
					class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-surface-200-800"
					transition:slide={{ duration: 200 }}
				>
					{#each searchResults as result (result.uuid)}
						<button
							type="button"
							onclick={() => selectAddress(result)}
							class="flex w-full items-center gap-3 border-b border-surface-100-900 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-100-900"
						>
							<IconMapPin size={18} class="text-error-500" />
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium text-surface-900-100">
									{formatAddressResult(result)}
								</div>
								{#if result.id_address}
									<div class="truncate text-xs text-surface-600-400">
										{result.id_address}
									</div>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}

			{#if searchQuery.length >= 2 && !searching && searchResults.length === 0}
				<div
					class="mt-4 py-4 text-center text-surface-600-400"
					transition:slide={{ duration: 200 }}
				>
					{m.common_no_results()}
				</div>
			{/if}

			{#if searchQuery.length < 2 && !searching}
				<div class="mt-4 py-4 text-center text-sm text-surface-600-400">
					{m.trace_search_hint()}
				</div>
			{/if}
		{:else if loadingAddress}
			<div class="flex items-center justify-center py-12">
				<IconLoader2 size={28} class="text-primary-500 animate-spin" />
			</div>
		{:else}
			<div class="flex items-center gap-3 rounded-lg bg-surface-100-900 px-4 py-3 mb-4">
				<IconMapPin size={20} class="text-error-500" />
				<div class="min-w-0 flex-1">
					<div class="font-medium text-surface-900-100">
						{selectedAddress.street}
						{selectedAddress.housenumber}{selectedAddress.house_number_suffix || ''}
					</div>
					<div class="text-xs text-surface-600-400">
						{selectedAddress.zip_code}
						{selectedAddress.city}
						{#if selectedAddress.district}
							· {selectedAddress.district}
						{/if}
					</div>
				</div>
				<button
					type="button"
					onclick={clearSelection}
					class="rounded-full p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-700-300"
				>
					<IconX size={18} />
				</button>
			</div>

			<div class="space-y-4">
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
					<div>
						<span class="text-surface-500-400">{m.form_id_address({ count: 1 })}</span>
						<p class="font-mono font-medium">{selectedAddress.id_address || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_street()}</span>
						<p class="font-medium">{selectedAddress.street || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_housenumber()}</span>
						<p class="font-medium">
							{selectedAddress.housenumber ?? '–'}{selectedAddress.house_number_suffix || ''}
						</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_zip_code()}</span>
						<p class="font-medium">{selectedAddress.zip_code || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_city()}</span>
						<p class="font-medium">{selectedAddress.city || '–'}</p>
					</div>
					<div>
						<span class="text-surface-500-400">{m.form_district()}</span>
						<p class="font-medium">{selectedAddress.district || '–'}</p>
					</div>
				</div>

				<div class="border-t border-surface-200-800 pt-4">
					<button
						class="btn preset-filled-primary-500 inline-flex items-center gap-2"
						onclick={() => (exportDialogOpen = true)}
					>
						<span>{m.pc_export()}</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<ExportDialog
	bind:open={exportDialogOpen}
	address={selectedAddress}
	{residentialUnits}
	{linkedMicroducts}
	{statusDevelopments}
/>
