<script lang="ts">
	import type { TrenchConnection } from '$lib/remote/trench/connection-data';
	import { page } from '$app/state';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconChevronDown,
		IconChevronUp,
		IconTrash,
		IconX
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { registerStorageProjection, storageProjection } from '$lib/map/projectionUtils.js';
	import { parseFeatureGeometry, zoomToFeature } from '$lib/map/searchUtils';
	import { globalToaster } from '$lib/stores/toaster';
	import { logToBackendClient } from '$lib/utils/logToBackendClient';
	import { remoteErrorMessage } from '$lib/remote/shared/remote-error';
	import {
		deleteTrenchConnection,
		getTrenchConnections
	} from '$lib/remote/trench/connections.remote';
	import { getTrenchGeometry } from '$lib/remote/trench/routing.remote';

	import { getTrenchAssignment } from '../TrenchAssignmentState.svelte';
	import { getTrenchMapManagers } from '../trenchMapContext';

	let { conduitUuid }: { conduitUuid: string } = $props();

	const { mapState } = getTrenchMapManagers();
	const assignment = getTrenchAssignment();

	let requestedPage = $state(1);
	let pageSize = $state(10);
	let searchTerm = $state('');
	let sortDirection = $state<'asc' | 'desc'>('asc');

	const connections = $derived(await getTrenchConnections(conduitUuid));

	const filtered = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return connections;
		return connections.filter((connection) => connection.label.toLowerCase().includes(term));
	});

	const sorted = $derived(
		filtered.toSorted((a, b) => {
			const order = a.label.localeCompare(b.label, undefined, { numeric: true });
			return sortDirection === 'asc' ? order : -order;
		})
	);

	const count = $derived(sorted.length);
	const currentPage = $derived(Math.min(requestedPage, Math.max(1, Math.ceil(count / pageSize))));
	const rows = $derived(sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize));

	/** Mirrors the conduit's trenches onto the map for as long as the table shows them. */
	function highlightLinkedTrenches() {
		const shownConduit = conduitUuid;
		assignment.trenchHighlights.show(
			shownConduit,
			connections.map((connection) => connection.trenchUuid)
		);
		return () => assignment.trenchHighlights.hide(shownConduit);
	}

	function toggleSort() {
		sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
	}

	/**
	 * Applies a search term and returns to the first page of its results.
	 * @param term - The new search term
	 */
	function search(term: string) {
		searchTerm = term;
		requestedPage = 1;
	}

	/**
	 * Zooms the map to a trench and blinks it.
	 * @param connection - The table row that was picked
	 */
	async function locateTrench(connection: TrenchConnection) {
		const map = mapState.olMap;
		if (!map) {
			globalToaster.error({ title: m.title_error_loading_map_features() });
			return;
		}

		try {
			const feature = await getTrenchGeometry(connection.trenchUuid);
			registerStorageProjection(page.data.srid, page.data.proj4Def);
			const geometry = await parseFeatureGeometry(
				feature,
				storageProjection(page.data.srid),
				map.getView().getProjection().getCode()
			);
			if (!geometry) throw new Error('Trench has no geometry');

			await zoomToFeature(map, geometry, assignment.routeOverlay.highlightLayer, { maxZoom: 20 });
			globalToaster.success({
				title: m.title_trench_located(),
				description: m.message_trench_located_description({ trenchLabel: connection.label })
			});
		} catch (err) {
			report('Error zooming to trench', 'locateTrench', err);
			globalToaster.error({
				title: m.title_trench_not_visible(),
				description: m.message_trench_not_visible_description({ trenchLabel: connection.label })
			});
		}
	}

	/**
	 * Removes the conduit from a trench; the row leaves the table at once and
	 * returns if the backend refuses.
	 * @param connection - The table row to delete
	 */
	async function removeConnection(connection: TrenchConnection) {
		try {
			await deleteTrenchConnection({ conduitUuid, connectionUuid: connection.uuid }).updates(
				getTrenchConnections(conduitUuid).withOverride((saved) =>
					saved.filter((row) => row.uuid !== connection.uuid)
				)
			);
			globalToaster.success({ description: m.message_trench_connection_deleted() });
		} catch (err) {
			report('Error deleting trench connection', 'removeConnection', err);
			globalToaster.error({
				title: m.message_error_deleting_trench_connection(),
				description: remoteErrorMessage(err) ?? undefined
			});
		}
	}

	function report(message: string, from: string, err: unknown) {
		void logToBackendClient({
			level: 'ERROR',
			message,
			extraData: {
				from: `TrenchConnectionTable.${from}`,
				error: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined
			}
		});
	}
</script>

<div class="flex flex-col h-full" {@attach highlightLinkedTrenches}>
	<div class="flex items-center gap-3 mb-3">
		<h3 class="text-xs font-semibold text-surface-600-400 uppercase tracking-wide shrink-0">
			{m.form_trench_id()}
		</h3>
		<div class="flex-1 relative">
			<input
				type="search"
				class="input w-full text-sm pl-3 pr-8 py-1.5"
				placeholder={m.common_search()}
				aria-label={m.common_search()}
				value={searchTerm}
				oninput={(e) => search(e.currentTarget.value)}
			/>
			{#if searchTerm}
				<button
					type="button"
					class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
					onclick={() => search('')}
					aria-label={m.common_clear()}
				>
					<IconX class="size-4" />
				</button>
			{/if}
		</div>
	</div>

	<div class="flex-1 min-h-0 overflow-auto rounded-md border border-surface-200-800">
		{#if rows.length === 0}
			<div class="flex items-center justify-center h-32 text-surface-400 text-sm">
				{searchTerm ? m.common_no_results() : m.message_no_trenches()}
			</div>
		{:else}
			<table class="table table-fixed w-full">
				<thead>
					<tr>
						<th class="py-2 px-3" aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}>
							<button
								type="button"
								class="flex items-center gap-1 text-xs font-semibold text-surface-600-400 uppercase tracking-wide"
								onclick={toggleSort}
							>
								<span>{m.form_trench_id()}</span>
								{#if sortDirection === 'asc'}
									<IconChevronUp class="size-4" />
								{:else}
									<IconChevronDown class="size-4" />
								{/if}
							</button>
						</th>
						<th class="w-12"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-200-800">
					{#each rows as row (row.uuid)}
						<tr class="group hover:bg-surface-100-900 transition-colors">
							<td class="p-0 text-sm">
								<button
									type="button"
									class="w-full py-2.5 px-3 text-left cursor-pointer touch-manipulation"
									onclick={() => locateTrench(row)}
								>
									{row.label}
								</button>
							</td>
							<td class="py-2.5 px-3 text-right w-12">
								<button
									type="button"
									class="btn btn-sm p-1.5 opacity-40 group-hover:opacity-100 transition-opacity hover:text-error-500"
									aria-label={m.common_delete()}
									onclick={() => removeConnection(row)}
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
				page={currentPage}
				onPageChange={(e) => (requestedPage = e.page)}
				{pageSize}
				onPageSizeChange={(e) => (pageSize = e.pageSize)}
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
