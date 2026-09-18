<script lang="ts">
	import type { ConduitListRow } from '$lib/remote/conduit/conduit-data';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconChevronDown,
		IconChevronUp,
		IconSelector
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore } from '$lib/stores/drawer';

	import ConduitDrawerTabs from './drawer/ConduitDrawerTabs.svelte';

	let {
		pipes,
		pagination
	}: {
		pipes: ConduitListRow[];
		pagination: { totalCount: number; pageSize: number; page: number };
	} = $props();

	type ColumnKey = keyof ConduitListRow;

	const columnConfig: {
		key: ColumnKey;
		label: string;
		sortable: boolean;
		filterable: boolean;
		sortType?: 'date';
	}[] = [
		{ key: 'name', label: m.common_name(), sortable: true, filterable: true },
		{ key: 'conduit_type', label: m.form_conduit_type(), sortable: true, filterable: true },
		{ key: 'outer_conduit', label: m.form_outer_conduit(), sortable: true, filterable: true },
		{ key: 'status', label: m.form_status(), sortable: true, filterable: true },
		{ key: 'network_level', label: m.form_network_level(), sortable: true, filterable: true },
		{ key: 'owner', label: m.form_owner(), sortable: true, filterable: true },
		{ key: 'constructor', label: m.form_constructor(), sortable: true, filterable: true },
		{ key: 'manufacturer', label: m.form_manufacturer(), sortable: true, filterable: true },
		{ key: 'date', label: m.common_date(), sortable: true, filterable: true, sortType: 'date' },
		{ key: 'flag', label: m.form_flag(), sortable: true, filterable: true }
	];

	let sortColumn = $state<ColumnKey | null>(null);
	let sortDirection = $state('asc');

	let filters = $state<Record<string, string>>({
		name: '',
		conduit_type: '',
		outer_conduit: '',
		status: '',
		network_level: '',
		owner: '',
		constructor: '',
		manufacturer: '',
		date: '',
		flag: ''
	});

	let mobileSearchTerm = $state('');

	/**
	 * Cycles sort state for a column: asc → desc → unsorted.
	 * @param columnKey - The column key to sort by.
	 */
	function toggleSort(columnKey: ColumnKey) {
		if (sortColumn === columnKey) {
			if (sortDirection === 'asc') {
				sortDirection = 'desc';
			} else {
				sortColumn = null;
				sortDirection = 'asc';
			}
		} else {
			sortColumn = columnKey;
			sortDirection = 'asc';
		}
	}

	/**
	 * Updates the filter value for a specific column.
	 * @param columnKey - The column key to filter.
	 * @param value - The filter value.
	 */
	function updateFilter(columnKey: ColumnKey, value: string) {
		filters[columnKey] = value;
	}

	/**
	 * Navigates to a specific page by updating the URL search params.
	 * @param newPage - The page number to navigate to.
	 */
	function goToPage(newPage: number) {
		const url = new URL(window.location.href);
		url.searchParams.set('page', String(newPage));
		const projectId = page.params.projectId;
		const query = url.searchParams.toString();
		goto(resolve(projectId ? `/conduit/${projectId}?${query}` : `/conduit?${query}`));
	}

	const filteredPipes = $derived.by(() => {
		return pipes.filter((pipe) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				const cellValue = String(pipe[key as ColumnKey] || '').toLowerCase();
				return cellValue.includes(filterValue.toLowerCase());
			});
		});
	});

	const sortedPipes = $derived.by(() => {
		if (!sortColumn) return filteredPipes;

		const col = sortColumn;
		const column = columnConfig.find((c) => c.key === col);

		return [...filteredPipes].sort((a, b) => {
			let aVal: string | number = '';
			let bVal: string | number = '';
			const aRaw = a[col];
			const bRaw = b[col];

			if (column?.sortType === 'date') {
				aVal = aRaw ? new Date(String(aRaw)).getTime() : 0;
				bVal = bRaw ? new Date(String(bRaw)).getTime() : 0;
			} else {
				aVal = String(aRaw ?? '').toLowerCase();
				bVal = String(bRaw ?? '').toLowerCase();
			}

			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	});

	const mobileFilteredPipes = $derived.by(() => {
		if (!mobileSearchTerm) return sortedPipes;

		const term = mobileSearchTerm.toLowerCase();
		return sortedPipes.filter((pipe) => {
			return Object.values(pipe).some((value) =>
				String(value || '')
					.toLowerCase()
					.includes(term)
			);
		});
	});

	/**
	 * Opens the drawer for a conduit; the drawer's cards load the details.
	 * @param pipe - The clicked row.
	 */
	function handleRowClick(pipe: ConduitListRow) {
		drawerStore.open({
			title: pipe.name || m.common_conduit_details(),
			component: ConduitDrawerTabs,
			props: { uuid: pipe.value }
		});
	}
</script>

<div class="flex flex-col h-full min-h-0" data-testid="conduit-table-container">
	<div class="flex-1 min-h-0 overflow-y-auto">
		<!-- Desktop table -->
		<div class="hidden md:block" data-testid="conduit-desktop-view">
			<div class="table-wrap overflow-x-auto">
				<table class="table table-card caption-bottom w-full overflow-scroll">
					<thead>
						<tr>
							{#each columnConfig as column (column.key)}
								<th
									class={column.sortable
										? 'cursor-pointer select-none hover:bg-surface-100-800 transition-colors'
										: ''}
									onclick={() => column.sortable && toggleSort(column.key)}
									role={column.sortable ? 'button' : undefined}
									tabindex={column.sortable ? 0 : undefined}
									onkeydown={(e) => e.key === 'Enter' && column.sortable && toggleSort(column.key)}
								>
									<div class="flex items-center gap-1 text-surface-contrast-100-900">
										<span>{column.label}</span>
										{#if column.sortable}
											<span class="inline-flex">
												{#if sortColumn === column.key}
													{#if sortDirection === 'asc'}
														<IconChevronUp class="size-4" />
													{:else}
														<IconChevronDown class="size-4" />
													{/if}
												{:else}
													<IconSelector class="size-4 text-surface-contrast-100-900" />
												{/if}
											</span>
										{/if}
									</div>
								</th>
							{/each}
						</tr>

						<tr class="bg-surface-50-900">
							{#each columnConfig as column (column.key)}
								<th class="p-1">
									{#if column.filterable}
										<input
											id={`filter-${column.key}`}
											name={`filter-${column.key}`}
											type="text"
											class="input text-sm py-1 px-2 w-full text-surface-contrast-100-900"
											placeholder={m.common_search()}
											value={filters[column.key]}
											oninput={(e) =>
												updateFilter(column.key, (e.target as HTMLInputElement).value)}
										/>
									{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
						{#each sortedPipes as row (row.value)}
							<tr onclick={() => handleRowClick(row)}>
								{#each columnConfig as column (column.key)}
									<td data-label={column.label}>{row[column.key]}</td>
								{/each}
							</tr>
						{:else}
							<tr>
								<td colspan={columnConfig.length} class="text-center py-8 text-surface-500">
									{m.message_no_results_found()}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile cards -->
		<div class="md:hidden" data-testid="conduit-mobile-view">
			<div class="mb-3">
				<input
					id="mobile-search"
					name="mobile-search"
					type="text"
					class="input w-full"
					placeholder={m.common_search()}
					bind:value={mobileSearchTerm}
				/>
			</div>

			<div class="space-y-3">
				{#each mobileFilteredPipes as row (row.value)}
					<div
						class="card p-4 space-y-3 cursor-pointer hover:bg-surface-100-800 transition-colors touch-manipulation"
						onclick={() => handleRowClick(row)}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								handleRowClick(row);
							}
						}}
						role="button"
						tabindex="0"
						data-testid="conduit-card"
					>
						<div class="flex items-center justify-between border-b border-surface-200-800 pb-2">
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-lg truncate">{row.name}</h3>
								<p class="text-sm">{row.conduit_type}</p>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-3 text-sm">
							<div>
								<span class="font-medium text-surface-600-400">{m.form_outer_conduit()}:</span>
								<p class="truncate">{row.outer_conduit}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_status()}:</span>
								<p class="truncate">{row.status}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_network_level()}:</span>
								<p class="truncate">{row.network_level}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_owner()}:</span>
								<p class="truncate">{row.owner}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_constructor()}:</span>
								<p class="truncate">{row.constructor}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_manufacturer()}:</span>
								<p class="truncate">{row.manufacturer}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.common_date()}:</span>
								<p class="truncate">{row.date}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_flag()}:</span>
								<p class="truncate">{row.flag}</p>
							</div>
						</div>
					</div>
				{:else}
					<div class="text-center py-8 text-surface-500">
						{m.message_no_results_found()}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Pagination -->
	<div class="shrink-0 pt-4">
		<div class="flex items-center justify-between gap-4">
			<span class="text-sm text-surface-600-400" data-testid="pagination-count">
				{pagination.totalCount}
				{m.common_results({ count: pagination.totalCount })}
			</span>
			<Pagination
				count={pagination.totalCount}
				pageSize={pagination.pageSize}
				page={pagination.page}
				onPageChange={(e) => goToPage(e.page)}
			>
				<Pagination.PrevTrigger>
					<IconArrowLeft class="size-4" />
				</Pagination.PrevTrigger>
				<Pagination.Context>
					{#snippet children(paginationCtx)}
						{#each paginationCtx().pages as pageItem, index (pageItem)}
							{#if pageItem.type === 'page'}
								<Pagination.Item {...pageItem}>
									{pageItem.value}
								</Pagination.Item>
							{:else}
								<Pagination.Ellipsis {index}>…</Pagination.Ellipsis>
							{/if}
						{/each}
					{/snippet}
				</Pagination.Context>
				<Pagination.NextTrigger>
					<IconArrowRight class="size-4" />
				</Pagination.NextTrigger>
			</Pagination>
		</div>
	</div>
</div>
