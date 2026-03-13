<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconChevronDown,
		IconChevronUp,
		IconSelector
	} from '@tabler/icons-svelte';
	import Fuse from 'fuse.js';

	import { m } from '$lib/paraglide/messages';

	let { addresses, pagination } = $props();

	const columnConfig = [
		{ key: 'id_address', label: m.form_id_address(), sortable: true, filterable: true },
		{ key: 'street', label: m.form_street(), sortable: true, filterable: true },
		{ key: 'housenumber', label: m.form_housenumber(), sortable: true, filterable: true },
		{
			key: 'house_number_suffix',
			label: m.form_house_number_suffix(),
			sortable: true,
			filterable: true
		},
		{ key: 'zip_code', label: m.form_zip_code(), sortable: true, filterable: true },
		{ key: 'city', label: m.form_city(), sortable: true, filterable: true },
		{ key: 'district', label: m.form_district(), sortable: true, filterable: true },
		{
			key: 'status_development',
			label: m.form_status_development(),
			sortable: true,
			filterable: true
		},
		{ key: 'flag', label: m.form_flag(), sortable: true, filterable: true }
	];

	let sortColumn = $state(/** @type {string | null} */ (null));
	let sortDirection = $state('asc');

	/** @type {Record<string, string>} */
	let filters = $state({
		id_address: '',
		street: '',
		housenumber: '',
		house_number_suffix: '',
		zip_code: '',
		city: '',
		district: '',
		status_development: '',
		flag: ''
	});

	let mobileSearchTerm = $state('');

	const fuseKeys = columnConfig.map((col) => col.key);

	/**
	 * Cycles sort state for a column: asc → desc → unsorted.
	 * @param {string} columnKey - The column key to sort by.
	 */
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
	 * Updates the filter value for a specific column.
	 * @param {string} columnKey - The column key to filter.
	 * @param {string} value - The filter value.
	 */
	function updateFilter(columnKey, value) {
		filters[columnKey] = value;
	}

	/**
	 * Navigates to a specific page by updating the URL search params.
	 * @param {number} newPage - The page number to navigate to.
	 */
	function goToPage(newPage) {
		const url = new URL(window.location.href);
		url.searchParams.set('page', String(newPage));
		goto(url.pathname + url.search);
	}

	/**
	 * Changes the page size and resets to page 1.
	 * @param {number} newSize - The new page size.
	 */
	function changePageSize(newSize) {
		const url = new URL(window.location.href);
		url.searchParams.set('page_size', String(newSize));
		url.searchParams.set('page', '1');
		goto(url.pathname + url.search);
	}

	const filteredAddresses = $derived.by(() => {
		const activeFilters = Object.entries(filters).filter(([, value]) => value.trim());
		if (activeFilters.length === 0) return addresses;

		return addresses.filter((/** @type {any} */ address) => {
			return activeFilters.every(([key, filterValue]) => {
				const cellValue = String(address[key] || '');
				const columnFuse = new Fuse([{ value: cellValue }], {
					keys: ['value'],
					threshold: 0.3
				});
				return columnFuse.search(filterValue).length > 0;
			});
		});
	});

	const sortedAddresses = $derived.by(() => {
		if (!sortColumn) return filteredAddresses;
		const col = sortColumn;

		return [...filteredAddresses].sort((a, b) => {
			let aVal = a[col] ?? '';
			let bVal = b[col] ?? '';

			if (col === 'housenumber') {
				aVal = aVal !== '' ? Number(aVal) : 0;
				bVal = bVal !== '' ? Number(bVal) : 0;
			} else {
				aVal = String(aVal).toLowerCase();
				bVal = String(bVal).toLowerCase();
			}

			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	});

	const mobileFuse = $derived(
		new Fuse(sortedAddresses, {
			keys: fuseKeys,
			threshold: 0.3
		})
	);

	const mobileFilteredAddresses = $derived.by(() => {
		if (!mobileSearchTerm.trim()) return sortedAddresses;
		const results = mobileFuse.search(mobileSearchTerm);
		return results.length > 0 ? results.map((r) => r.item) : sortedAddresses;
	});

	/**
	 * Navigates to the detail page for the clicked address.
	 * @param {any} address - The address row object.
	 */
	function handleRowClick(address) {
		const projectId = page.params.projectId;
		goto(`/address/${projectId}/${address.value}`);
	}
</script>

<div class="flex flex-col h-full min-h-0">
	<div class="flex-1 min-h-0 overflow-y-auto">
		<!-- Desktop table -->
		<div class="hidden md:block">
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
												updateFilter(column.key, /** @type {HTMLInputElement} */ (e.target).value)}
										/>
									{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
						{#each sortedAddresses as row (row.value)}
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
		<div class="md:hidden">
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
				{#each mobileFilteredAddresses as row (row.value)}
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
					>
						<div class="flex items-center justify-between border-b border-surface-200-800 pb-2">
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-lg truncate">
									{row.street}
									{row.housenumber}{row.house_number_suffix}
								</h3>
								<p class="text-sm">{row.zip_code} {row.city}</p>
							</div>
							{#if row.id_address}
								<span class="badge preset-tonal-primary text-xs font-mono">{row.id_address}</span>
							{/if}
						</div>

						<div class="grid grid-cols-2 gap-3 text-sm">
							<div>
								<span class="font-medium text-surface-600-400">{m.form_district()}:</span>
								<p class="truncate">{row.district}</p>
							</div>
							<div>
								<span class="font-medium text-surface-600-400">{m.form_status_development()}:</span>
								<p class="truncate">{row.status_development}</p>
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
			<span class="text-sm text-surface-600-400">
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
