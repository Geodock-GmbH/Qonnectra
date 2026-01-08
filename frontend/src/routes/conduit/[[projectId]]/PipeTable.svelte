<script>
	import { deserialize } from '$app/forms';
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

	let { pipes, onConduitUpdate = () => {}, onConduitDelete = () => {} } = $props();

	let page = $state(1);
	let size = $state(20);

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
	let sortColumn = $state(null);
	let sortDirection = $state('asc');

	// Filter state - object with column keys
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
		page = 1; // Reset to first page on sort change
	}

	/**
	 * Update filter for a column
	 */
	function updateFilter(columnKey, value) {
		filters[columnKey] = value;
		page = 1; // Reset to first page on filter change
	}

	// Apply filters to pipes
	const filteredPipes = $derived.by(() => {
		return pipes.filter((pipe) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				const cellValue = String(pipe[key] || '').toLowerCase();
				return cellValue.includes(filterValue.toLowerCase());
			});
		});
	});

	// Apply sorting to filtered pipes
	const sortedPipes = $derived.by(() => {
		if (!sortColumn) return filteredPipes;

		const column = columnConfig.find((c) => c.key === sortColumn);

		return [...filteredPipes].sort((a, b) => {
			let aVal = a[sortColumn] ?? '';
			let bVal = b[sortColumn] ?? '';

			// Handle date sorting
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

	// Paginate sorted data
	const slicedSource = $derived(sortedPipes.slice((page - 1) * size, page * size));

	// Mobile filtered and paginated data
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

	const mobileSlicedSource = $derived(mobileFilteredPipes.slice((page - 1) * size, page * size));

	// Total count for pagination - use sortedPipes for desktop, mobileFilteredPipes for mobile
	// We'll use sortedPipes.length as the baseline since mobile filter is additive
	const totalFilteredCount = $derived(sortedPipes.length);
	const mobileTotalCount = $derived(mobileFilteredPipes.length);

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

			const conduitData = result.data?.conduit;

			// Open drawer with conduit details
			drawerStore.open({
				title: conduitData?.name || m.common_conduit_details(),
				component: ConduitDrawerTabs,
				props: {
					...conduitData,
					onConduitUpdate: (updatedConduit) => {
						onConduitUpdate(updatedConduit);
						drawerStore.setTitle(updatedConduit.name);
					},
					onConduitDelete: (conduitId) => {
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
					type="text"
					class="input w-full"
					placeholder={m.common_search()}
					bind:value={mobileSearchTerm}
					oninput={() => (page = 1)}
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
	<div class="flex-shrink-0 pt-4">
		<!-- Desktop pagination (uses desktop filter count) -->
		<div class="hidden md:block">
			<Pagination
				count={totalFilteredCount}
				pageSize={size}
				{page}
				onPageChange={(e) => (page = e.page)}
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
				{page}
				onPageChange={(e) => (page = e.page)}
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
