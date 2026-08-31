<script lang="ts">
	import { deserialize } from '$app/forms';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconChevronDown,
		IconChevronUp,
		IconTrash
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';
	import { actionData } from '$lib/utils/forms';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';

	interface TrenchConnection {
		value: string;
		label: string;
		trench: string;
	}

	interface Props {
		projectId?: string;
		conduitId?: string;
		onTrenchClick?: (trench: string, label: string) => void;
		onTrenchesChange?: (trenches: TrenchConnection[]) => void;
	}

	let { projectId, conduitId, onTrenchClick, onTrenchesChange }: Props = $props();

	let trenches = $state<TrenchConnection[]>([]);
	let trenchesError = $state<string | null>(null);
	let loading = $state(false);
	let page = $state(1);
	let size = $state(10);
	let deletingIds = $state(new Set<string>());
	let searchTerm = $state('');
	let sortDirection = $state<'asc' | 'desc'>('asc');

	const filteredTrenches = $derived.by(() => {
		if (!searchTerm.trim()) return trenches;
		const term = searchTerm.toLowerCase();
		return trenches.filter((trench) => trench.label?.toLowerCase().includes(term));
	});

	const sortedTrenches = $derived.by(() => {
		return [...filteredTrenches].sort((a, b) => {
			const aVal = (a.label ?? '').toLowerCase();
			const bVal = (b.label ?? '').toLowerCase();
			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	});

	let count = $derived(sortedTrenches.length);
	const slicedSource = $derived(sortedTrenches.slice((page - 1) * size, page * size));

	/**
	 * Fetches trench connections for the selected conduit
	 */
	async function fetchTrenches(): Promise<void> {
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
				const errorData = actionData(result) as { error?: string } | undefined;
				throw new Error(errorData?.error || 'Failed to fetch trenches');
			}

			const successData = actionData(result) as { trenches?: TrenchConnection[] } | undefined;
			trenches = successData?.trenches || [];
		} catch (error) {
			trenchesError = m.message_error_fetching_trenches();
			console.error('Error fetching trenches:', error);
			void logToBackendClient({
				level: 'ERROR',
				message: 'Error fetching trenches',
				extraData: {
					from: 'TrenchTable.fetchTrenches',
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined
				}
			});
		} finally {
			loading = false;
			onTrenchesChange?.(trenches);
		}
	}

	/**
	 * Deletes a trench connection by ID
	 * @param connectionId - UUID of the connection to delete
	 */
	async function deleteTrench(connectionId: string): Promise<void> {
		const formData = new FormData();
		formData.append('connectionId', connectionId);

		const response = await fetch('?/deleteTrenchConnection', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			const errorData = actionData(result) as { error?: string } | undefined;
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
	 * @param trenchId - UUID of the trench connection to delete
	 */
	function handleDelete(trenchId: string): void {
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
	 * @param trenchId - UUID of the trench to connect
	 */
	async function saveTrenchConnection(trenchId: string): Promise<void> {
		const formData = new FormData();
		formData.append('conduitId', conduitId as string);
		formData.append('trenchId', trenchId);

		const response = await fetch('?/createTrenchConnection', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			const errorData = actionData(result) as { error?: string } | undefined;
			console.error('Failed to save trench connection:', errorData?.error);
			throw new Error(errorData?.error);
		}
	}

	/**
	 * Clears the trench table data
	 */
	function emptyTable(): void {
		trenches = [];
		trenchesError = null;
		loading = false;
	}

	/**
	 * Adds routed trenches to the table, creating connections for new trenches
	 * @param routedTrenches - Array of trench objects to add
	 */
	export async function addRoutedTrenches(
		routedTrenches: Array<{ value: string; label: string }>
	): Promise<void> {
		if (!routedTrenches?.length) return;

		const existingTrenchValues = new Set(trenches.map((t) => t.trench));
		const newTrenches = routedTrenches.filter((t) => !existingTrenchValues.has(t.value));

		if (newTrenches.length > 0) {
			try {
				const savePromises = newTrenches.map((trench) => saveTrenchConnection(trench.value));

				await Promise.all(savePromises);
				fetchTrenches();
				globalToaster.success({
					description: m.message_trench_connection_saved()
				});
			} catch (error) {
				console.error('Error saving trench connections:', error);
				void logToBackendClient({
					level: 'ERROR',
					message: 'Error saving trench connections',
					extraData: {
						from: 'TrenchTable.addRoutedTrenches',
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined
					}
				});
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_saving_data()
				});
			}
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
				<thead>
					<tr>
						<th
							class="cursor-pointer select-none hover:bg-surface-100-800 transition-colors py-2 px-3"
							onclick={() => (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}
							role="button"
							tabindex={0}
							onkeydown={(e) =>
								e.key === 'Enter' && (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}
						>
							<div
								class="flex items-center gap-1 text-xs font-semibold text-surface-600-400 uppercase tracking-wide"
							>
								<span>{m.form_trench_id()}</span>
								{#if sortDirection === 'asc'}
									<IconChevronUp class="size-4" />
								{:else}
									<IconChevronDown class="size-4" />
								{/if}
							</div>
						</th>
						<th class="w-12"></th>
					</tr>
				</thead>
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
								<Pagination.Ellipsis {index}>…</Pagination.Ellipsis>
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
