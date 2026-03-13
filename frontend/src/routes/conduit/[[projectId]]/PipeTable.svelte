<script>
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
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
	import { globalToaster } from '$lib/stores/toaster';

	import ConduitDrawerTabs from './ConduitDrawerTabs.svelte';

	let { pipes, pagination, onConduitUpdate = () => {}, onConduitDelete = () => {} } = $props();

	// Column configuration with sortable/filterable flags
	const columnConfig = [
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

	// Sort state
	/** @type {string | null} */
	let sortColumn = $state(null);
	let sortDirection = $state('asc');

	// Filter state - object with column keys
	/** @type {Record<string, string>} */
	let filters = $state({
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

	// Mobile global filter
	let mobileSearchTerm = $state('');

	/** @param {string} columnKey */
	function toggleSort(columnKey) {
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
	 * @param {string} columnKey
	 * @param {string} value
	 */
	function updateFilter(columnKey, value) {
		filters[columnKey] = value;
	}

	/** @param {number} newPage */
	function goToPage(newPage) {
		const url = new URL(window.location.href);
		url.searchParams.set('page', String(newPage));
		goto(url.pathname + url.search);
	}

	/** @param {number} newSize */
	function changePageSize(newSize) {
		const url = new URL(window.location.href);
		url.searchParams.set('page_size', String(newSize));
		url.searchParams.set('page', '1');
		goto(url.pathname + url.search);
	}

	// Apply filters to pipes
	const filteredPipes = $derived.by(() => {
		return pipes.filter((/** @type {Record<string, any>} */ pipe) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				const cellValue = String(pipe[key] || '').toLowerCase();
				return cellValue.includes(filterValue.toLowerCase());
			});
		});
	});

	const sortedPipes = $derived.by(() => {
		if (!sortColumn) return filteredPipes;

		const currentSortColumn = sortColumn;
		const column = columnConfig.find((c) => c.key === currentSortColumn);

		return [...filteredPipes].sort((a, b) => {
			let aVal = a[currentSortColumn] ?? '';
			let bVal = b[currentSortColumn] ?? '';

			if (column?.sortType === 'date') {
				aVal = aVal ? new Date(aVal).getTime() : 0;
				bVal = bVal ? new Date(bVal).getTime() : 0;
			} else {
				aVal = String(aVal).toLowerCase();
				bVal = String(bVal).toLowerCase();
			}

			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	});

	const mobileFilteredPipes = $derived.by(() => {
		if (!mobileSearchTerm) return sortedPipes;

		const term = mobileSearchTerm.toLowerCase();
		return sortedPipes.filter((/** @type {Record<string, any>} */ pipe) => {
			return Object.values(pipe).some((value) =>
				String(value || '')
					.toLowerCase()
					.includes(term)
			);
		});
	});

	/** @param {Record<string, any>} pipe */
	async function handleRowClick(pipe) {
		// Fetch full conduit details via server action
		const formData = new FormData();
		formData.append('uuid', pipe.value);

		try {
			const response = await fetch('?/getConduit', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				globalToaster.error({
					title: m.common_error(),
					description: m.message_error_fetching_conduit()
				});
				return;
			}

			const conduitData = /** @type {any} */ (result).data?.conduit;

			// Open drawer with conduit details
			drawerStore.open({
				title: conduitData?.name || m.common_conduit_details(),
				component: ConduitDrawerTabs,
				props: {
					...conduitData,
					onConduitUpdate: (/** @type {any} */ updatedConduit) => {
						onConduitUpdate(updatedConduit);
						drawerStore.setTitle(updatedConduit.name);
					},
					onConduitDelete: (/** @type {string} */ conduitId) => {
						onConduitDelete(conduitId);
					}
				}
			});
		} catch (error) {
			console.error('Error fetching conduit:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_conduit()
			});
		}
	}
</script>

<div class="flex flex-col h-full min-h-0" data-testid="conduit-table-container">
	<!-- Scrollable content area -->
	<div class="flex-1 min-h-0 overflow-y-auto">
		<!-- Desktop Table View -->
		<div class="hidden md:block" data-testid="conduit-desktop-view">
			<div class="table-wrap overflow-x-auto">
				<table class="table table-card caption-bottom w-full overflow-scroll">
					<thead>
						<!-- Header Row with Sort Indicators -->
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

						<!-- Filter Row -->
						<tr class="bg-surface-50-900">
							{#each columnConfig as column (column.key)}
								<th class="p-1">
									{#if column.filterable}
										<input
											type="text"
											class="input text-sm py-1 px-2 w-full text-surface-contrast-100-900"
											placeholder={m.common_search()}
											value={filters[column.key]}
											oninput={(e) =>
												updateFilter(column.key, /** @type {HTMLInputElement} */ (e.target).value)}
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

		<!-- Mobile Card View -->
		<div class="md:hidden" data-testid="conduit-mobile-view">
			<!-- Mobile Filter Input -->
			<div class="mb-3">
				<input
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
						<!-- Primary Info Row -->
						<div class="flex items-center justify-between border-b border-surface-200-800 pb-2">
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-lg truncate">{row.name}</h3>
								<p class="text-sm">{row.conduit_type}</p>
							</div>
						</div>

						<!-- Details Grid -->
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

	<!-- Fixed pagination at bottom -->
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
								<Pagination.Ellipsis {index}>&#8230;</Pagination.Ellipsis>
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
