<script>
	import { deserialize } from '$app/forms';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	let { projectId, conduitId, onTrenchClick, onTrenchesChange } = $props();

	/** @type {Array<{value: string, label: string, trench: string}>} */
	let trenches = $state([]);
	/** @type {string | null} */
	let trenchesError = $state(null);
	let loading = $state(false);
	let page = $state(1);
	let size = $state(10);
	let deletingIds = $state(new Set());
	let searchTerm = $state('');

	const filteredTrenches = $derived.by(() => {
		if (!searchTerm.trim()) return trenches;
		const term = searchTerm.toLowerCase();
		return trenches.filter((trench) => trench.label?.toLowerCase().includes(term));
	});

	let count = $derived(filteredTrenches.length);
	const slicedSource = $derived(filteredTrenches.slice((page - 1) * size, page * size));

	/**
	 * Fetches trench connections for the selected conduit
	 * @returns {Promise<void>}
	 */
	async function fetchTrenches() {
		if (!conduitId) {
			return;
		}

		loading = true;
		trenchesError = null;

		try {
			const formData = new FormData();
			formData.append('conduitId', conduitId);

			const response = await fetch('?/getTrenchConnections', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				const errorData = /** @type {{ error?: string }} */ (/** @type {any} */ (result).data);
				throw new Error(errorData?.error || 'Failed to fetch trenches');
			}

			const successData =
				/** @type {{ trenches?: Array<{value: string, label: string, trench: string}> }} */ (
					/** @type {any} */ (result).data
				);
			trenches = successData?.trenches || [];
		} catch (error) {
			trenchesError = m.message_error_fetching_trenches();
			console.error('Error fetching trenches:', error);
		} finally {
			loading = false;
			onTrenchesChange?.(trenches);
		}
	}

	/**
	 * Deletes a trench connection by ID
	 * @param {string} connectionId - UUID of the connection to delete
	 * @returns {Promise<void>}
	 */
	async function deleteTrench(connectionId) {
		const formData = new FormData();
		formData.append('connectionId', connectionId);

		const response = await fetch('?/deleteTrenchConnection', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			const errorData = /** @type {{ error?: string }} */ (/** @type {any} */ (result).data);
			console.error('Failed to delete trench connection:', errorData?.error);
			globalToaster.error({
				description: m.message_error_deleting_trench_connection()
			});
			throw new Error(errorData?.error);
		}

		await fetchTrenches();
	}

	/**
	 * Handles deletion of a trench connection with loading state management
	 * @param {string} trenchId - UUID of the trench connection to delete
	 * @returns {void}
	 */
	function handleDelete(trenchId) {
		if (deletingIds.has(trenchId)) return;

		deletingIds.add(trenchId);

		const promise = deleteTrench(trenchId).finally(() => {
			deletingIds.delete(trenchId);
		});

		globalToaster.promise(promise, {
			loading: {
				description: m.message_please_wait()
			},
			success: {
				description: m.message_trench_connection_deleted()
			},
			error: {
				description: m.message_error_deleting_trench_connection()
			}
		});
	}

	/**
	 * Saves a new trench connection for the selected conduit
	 * @param {string} trenchId - UUID of the trench to connect
	 * @returns {Promise<void>}
	 */
	async function saveTrenchConnection(trenchId) {
		const formData = new FormData();
		formData.append('conduitId', conduitId);
		formData.append('trenchId', trenchId);

		const response = await fetch('?/createTrenchConnection', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			const errorData = /** @type {{ error?: string }} */ (/** @type {any} */ (result).data);
			console.error('Failed to save trench connection:', errorData?.error);
			throw new Error(errorData?.error);
		}
	}

	/**
	 * Clears the trench table data
	 * @returns {void}
	 */
	function emptyTable() {
		trenches = [];
		trenchesError = null;
		loading = false;
	}

	/**
	 * Adds routed trenches to the table, creating connections for new trenches
	 * @param {Array<{value: string, label: string}>} routedTrenches - Array of trench objects to add
	 * @returns {Promise<void>}
	 */
	export async function addRoutedTrenches(routedTrenches) {
		if (!routedTrenches?.length) return;

		const existingTrenchValues = new Set(trenches.map((t) => t.trench));
		const newTrenches = routedTrenches.filter((t) => !existingTrenchValues.has(t.value));

		if (newTrenches.length > 0) {
			const savePromises = newTrenches.map((trench) => saveTrenchConnection(trench.value));

			await Promise.all(savePromises);
			fetchTrenches();
			globalToaster.success({
				description: m.message_trench_connection_saved()
			});
		} else {
			globalToaster.warning({
				description: m.message_no_new_trench_connections()
			});
		}
	}

	$effect(() => {
		if (conduitId) {
			fetchTrenches();
		} else {
			emptyTable();
		}
	});

	$effect(() => {
		if (projectId) {
			emptyTable();
		}
	});

	$effect(() => {
		if (count <= size) {
			page = 1;
		}
	});

	$effect(() => {
		searchTerm;
		page = 1;
	});
</script>

<div class="flex flex-col h-full">
	<div class="flex items-center gap-3 mb-3">
		<h3 class="text-xs font-semibold text-surface-600-400 uppercase tracking-wide shrink-0">
			{m.form_trench_id()}
		</h3>
		<div class="flex-1 relative">
			<input
				type="text"
				class="input w-full text-sm pl-3 pr-8 py-1.5"
				placeholder={m.common_search()}
				bind:value={searchTerm}
			/>
			{#if searchTerm}
				<button
					type="button"
					class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
					onclick={() => (searchTerm = '')}
					aria-label={m.common_search()}
				>
					<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<div class="flex-1 min-h-0 overflow-auto rounded-md border border-surface-200-800">
		{#if loading}
			<div class="flex items-center justify-center h-32">
				<div class="animate-pulse text-surface-400 text-sm">{m.common_loading()}</div>
			</div>
		{:else if trenchesError}
			<div class="flex items-center justify-center h-32 text-error-500 text-sm">
				{trenchesError}
			</div>
		{:else if slicedSource.length === 0}
			<div class="flex items-center justify-center h-32 text-surface-400 text-sm">
				{searchTerm ? m.common_no_results() : m.message_no_trenches()}
			</div>
		{:else}
			<table class="table table-fixed w-full">
				<tbody class="divide-y divide-surface-200-800">
					{#each slicedSource as row}
						<tr
							onclick={() => onTrenchClick?.(row.trench, row.label)}
							class="group cursor-pointer hover:bg-surface-100-900 transition-colors touch-manipulation"
						>
							<td class="py-2.5 px-3 text-sm">{row.label}</td>
							<td class="py-2.5 px-3 text-right w-12">
								<button
									class="btn btn-sm p-1.5 opacity-40 group-hover:opacity-100 transition-opacity hover:text-error-500"
									disabled={deletingIds.has(row.value)}
									onclick={(e) => {
										e.stopPropagation();
										handleDelete(row.value);
									}}
								>
									<IconTrash class="size-4" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	{#if count > 0}
		<div class="mt-3 flex items-center justify-between text-xs text-surface-500">
			<span>{count} {m.common_items()}</span>
			<Pagination
				{page}
				onPageChange={(e) => (page = e.page)}
				pageSize={size}
				onPageSizeChange={(e) => (size = e.pageSize)}
				siblingCount={1}
				{count}
			>
				<Pagination.PrevTrigger class="p-1.5 hover:bg-surface-200-800 rounded transition-colors">
					<IconArrowLeft class="size-4" />
				</Pagination.PrevTrigger>
				<Pagination.Context>
					{#snippet children(pagination)}
						{#each pagination().pages as pageItem, index (pageItem)}
							{#if pageItem.type === 'page'}
								<Pagination.Item
									{...pageItem}
									class="px-2 py-1 hover:bg-surface-200-800 rounded transition-colors data-selected:bg-primary-500 data-selected:text-white"
								>
									{pageItem.value}
								</Pagination.Item>
							{:else}
								<Pagination.Ellipsis {index}>&#8230;</Pagination.Ellipsis>
							{/if}
						{/each}
					{/snippet}
				</Pagination.Context>
				<Pagination.NextTrigger class="p-1.5 hover:bg-surface-200-800 rounded transition-colors">
					<IconArrowRight class="size-4" />
				</Pagination.NextTrigger>
			</Pagination>
		</div>
	{/if}
</div>
