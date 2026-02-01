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

	import { m } from '$lib/paraglide/messages';

	let { addresses } = $props();

	let pageNum = $state(1);
	let size = $state(20);

	// Column configuration with sortable/filterable flags
	const columnConfig = [
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

	// Sort state
	let sortColumn = $state(null);
	let sortDirection = $state('asc');

	// Filter state - object with column keys
	let filters = $state({
		street: '',
		housenumber: '',
		house_number_suffix: '',
		zip_code: '',
		city: '',
		district: '',
		status_development: '',
		flag: ''
	});

	// Mobile global filter
	let mobileSearchTerm = $state('');

	/**
	 * Toggle sort for a column (cycles through: asc -> desc -> none)
	 */
	function toggleSort(columnKey) {
		if (sortColumn === columnKey) {
			if (sortDirection === 'asc') {
				sortDirection = 'desc';
			} else {
				// Reset sort
				sortColumn = null;
				sortDirection = 'asc';
			}
		} else {
			sortColumn = columnKey;
			sortDirection = 'asc';
		}
		pageNum = 1; // Reset to first page on sort change
	}

	/**
	 * Update filter for a column
	 */
	function updateFilter(columnKey, value) {
		filters[columnKey] = value;
		pageNum = 1; // Reset to first page on filter change
	}

	// Apply filters to addresses
	const filteredAddresses = $derived.by(() => {
		return addresses.filter((address) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				const cellValue = String(address[key] || '').toLowerCase();
				return cellValue.includes(filterValue.toLowerCase());
			});
		});
	});

	// Apply sorting to filtered addresses
	const sortedAddresses = $derived.by(() => {
		if (!sortColumn) return filteredAddresses;

		return [...filteredAddresses].sort((a, b) => {
			let aVal = a[sortColumn] ?? '';
			let bVal = b[sortColumn] ?? '';

			// Handle numeric sorting for housenumber
			if (sortColumn === 'housenumber') {
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

	// Paginate sorted data
	const slicedSource = $derived(sortedAddresses.slice((pageNum - 1) * size, pageNum * size));

	// Mobile filtered and paginated data
	const mobileFilteredAddresses = $derived.by(() => {
		if (!mobileSearchTerm) return sortedAddresses;

		const term = mobileSearchTerm.toLowerCase();
		return sortedAddresses.filter((address) => {
			return Object.values(address).some((value) =>
				String(value || '')
					.toLowerCase()
					.includes(term)
			);
		});
	});

	const mobileSlicedSource = $derived(
		mobileFilteredAddresses.slice((pageNum - 1) * size, pageNum * size)
	);

	// Total count for pagination
	const totalFilteredCount = $derived(sortedAddresses.length);
	const mobileTotalCount = $derived(mobileFilteredAddresses.length);

	function handleRowClick(address) {
		const projectId = page.params.projectId;
		goto(`/address/${projectId}/${address.value}`);
	}
</script>

<div class="flex flex-col h-full min-h-0">
	<!-- Scrollable content area -->
	<div class="flex-1 min-h-0 overflow-y-auto">
		<!-- Desktop Table View -->
		<div class="hidden md:block">
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
											id={`filter-${column.key}`}
											name={`filter-${column.key}`}
											type="text"
											class="input text-sm py-1 px-2 w-full text-surface-contrast-100-900"
											placeholder={m.common_search()}
											value={filters[column.key]}
											oninput={(e) => updateFilter(column.key, e.target.value)}
										/>
									{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
						{#each slicedSource as row (row.value)}
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
		<div class="md:hidden">
			<!-- Mobile Filter Input -->
			<div class="mb-3">
				<input
					id="mobile-search"
					name="mobile-search"
					type="text"
					class="input w-full"
					placeholder={m.common_search()}
					bind:value={mobileSearchTerm}
					oninput={() => (pageNum = 1)}
				/>
			</div>

			<div class="space-y-3">
				{#each mobileSlicedSource as row (row.value)}
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
						<!-- Primary Info Row -->
						<div class="flex items-center justify-between border-b border-surface-200-800 pb-2">
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-lg truncate">
									{row.street}
									{row.housenumber}{row.house_number_suffix}
								</h3>
								<p class="text-sm">{row.zip_code} {row.city}</p>
							</div>
						</div>

						<!-- Details Grid -->
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

	<!-- Fixed pagination at bottom -->
	<div class="shrink-0 pt-4">
		<!-- Desktop pagination (uses desktop filter count) -->
		<div class="hidden md:block">
			<Pagination
				count={totalFilteredCount}
				pageSize={size}
				page={pageNum}
				onPageChange={(e) => (pageNum = e.page)}
			>
				<Pagination.PrevTrigger>
					<IconArrowLeft class="size-4" />
				</Pagination.PrevTrigger>
				<Pagination.Context>
					{#snippet children(pagination)}
						{#each pagination().pages as pageItem, index (pageItem)}
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

		<!-- Mobile pagination (uses mobile filter count) -->
		<div class="md:hidden">
			<Pagination
				count={mobileTotalCount}
				pageSize={size}
				page={pageNum}
				onPageChange={(e) => (pageNum = e.page)}
			>
				<Pagination.PrevTrigger>
					<IconArrowLeft class="size-4" />
				</Pagination.PrevTrigger>
				<Pagination.Context>
					{#snippet children(pagination)}
						{#each pagination().pages as pageItem, index (pageItem)}
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
