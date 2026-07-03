<script>
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
	import { getLocale } from '$lib/paraglide/runtime';

	/**
	 * Formats an ISO date string into a localized short date+time.
	 * @param {string | null | undefined} isoString
	 * @returns {string}
	 */
	function formatDate(isoString) {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleString(getLocale(), {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let { records, pagination } = $props();

	const columnConfig = [
		{ key: 'project_name', label: m.form_project({ count: 1 }), sortable: true, filterable: true },
		{ key: 'type_of_work', label: m.form_type_of_work(), sortable: true, filterable: true },
		{ key: 'request_reason', label: m.form_request_reason(), sortable: true, filterable: true },
		{ key: 'organisation', label: m.form_organisation(), sortable: true, filterable: true },
		{ key: 'name', label: m.form_name(), sortable: true, filterable: true },
		{
			key: 'created_at',
			label: m.common_created(),
			sortable: true,
			filterable: false,
			sortType: 'date',
			format: formatDate
		},
		{
			key: 'modified_at',
			label: m.common_modified(),
			sortable: true,
			filterable: false,
			sortType: 'date',
			format: formatDate
		}
	];

	/** @type {string | null} */
	let sortColumn = $state(null);
	let sortDirection = $state('asc');

	/** @type {Record<string, string>} */
	let filters = $state({
		project_name: '',
		type_of_work: '',
		request_reason: '',
		organisation: '',
		name: ''
	});

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
		goto(`${url.pathname}${url.search}`);
	}

	/**
	 * Navigates to the edit page for the clicked pipeline record.
	 * @param {Record<string, any>} record - The pipeline record row object.
	 */
	function handleRowClick(record) {
		goto(`/pipeline-records/${record.value}`);
	}

	const filteredRecords = $derived.by(() => {
		return records.filter((/** @type {Record<string, any>} */ record) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				const cellValue = String(record[key] || '').toLowerCase();
				return cellValue.includes(filterValue.toLowerCase());
			});
		});
	});

	const sortedRecords = $derived.by(() => {
		if (!sortColumn) return filteredRecords;

		const currentSortColumn = sortColumn;
		const column = columnConfig.find((c) => c.key === currentSortColumn);

		return [...filteredRecords].sort((a, b) => {
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

	const mobileFilteredRecords = $derived.by(() => {
		if (!mobileSearchTerm) return sortedRecords;

		const term = mobileSearchTerm.toLowerCase();
		return sortedRecords.filter((/** @type {Record<string, any>} */ record) => {
			return Object.values(record).some((value) =>
				String(value || '')
					.toLowerCase()
					.includes(term)
			);
		});
	});
</script>

<div class="flex flex-col h-full min-h-0" data-testid="pipeline-records-table-container">
	<div class="flex-1 min-h-0 overflow-y-auto">
		<!-- Desktop Table View -->
		<div class="hidden md:block" data-testid="pipeline-records-desktop-view">
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
						{#each sortedRecords as row (row.value)}
							<tr onclick={() => handleRowClick(row)}>
								{#each columnConfig as column (column.key)}
									<td data-label={column.label}
										>{column.format ? column.format(row[column.key]) : row[column.key]}</td
									>
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
		<div class="md:hidden" data-testid="pipeline-records-mobile-view">
			<div class="mb-3">
				<input
					type="text"
					class="input w-full"
					placeholder={m.common_search()}
					bind:value={mobileSearchTerm}
				/>
			</div>

			<div class="space-y-3">
				{#each mobileFilteredRecords as row (row.value)}
					<div
						class="card p-4 space-y-3 hover:bg-surface-100-800 transition-colors touch-manipulation cursor-pointer"
						data-testid="pipeline-record-card"
						role="button"
						tabindex="0"
						onclick={() => handleRowClick(row)}
						onkeydown={(e) => e.key === 'Enter' && handleRowClick(row)}
					>
						<div class="border-b border-surface-200-800 pb-2">
							<h3 class="font-semibold text-lg truncate">{row.project_name}</h3>
							<p class="text-sm">{row.organisation}</p>
						</div>

						<div class="grid grid-cols-2 gap-3 text-sm">
							<div>
								<span class="font-medium text-surface-600-400">{m.form_type_of_work()}:</span>
								<p class="truncate">{row.type_of_work}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_request_reason()}:</span>
								<p class="truncate">{row.request_reason}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_name()}:</span>
								<p class="truncate">{row.name}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.common_created()}:</span>
								<p class="truncate">{formatDate(row.created_at)}</p>
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
