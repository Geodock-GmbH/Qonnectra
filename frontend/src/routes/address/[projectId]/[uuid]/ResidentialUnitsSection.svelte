<script>
	import { deserialize } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import {
		IconArrowLeft,
		IconArrowRight,
		IconChevronDown,
		IconChevronUp,
		IconTrash,
		IconUsers
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	import ResidentialUnitModal from './ResidentialUnitModal.svelte';

	let {
		residentialUnits = [],
		residentialUnitTypes = [],
		residentialUnitStatuses = [],
		projectId = '',
		addressUuid = ''
	} = $props();

	let deletingUnitUuid = $state(null);
	let deleteMessageBox = $state(null);
	let openModal = $state(false);
	let page = $state(1);
	let size = $state(10);

	// Column configuration
	const columnConfig = [
		{
			key: 'id_residential_unit',
			label: m.table_residential_unit_id(),
			sortable: true,
			filterable: true
		},
		{ key: 'floor', label: m.table_floor(), sortable: true, filterable: true },
		{ key: 'side', label: m.table_side(), sortable: true, filterable: true },
		{
			key: 'residential_unit_type',
			label: m.table_residential_unit_type(),
			sortable: true,
			filterable: true
		},
		{ key: 'status', label: m.table_residential_unit_status(), sortable: true, filterable: true }
	];

	// Filter state
	let filters = $state({
		id_residential_unit: '',
		floor: '',
		side: '',
		residential_unit_type: '',
		status: ''
	});

	// Sort state
	let sortColumn = $state(null);
	let sortDirection = $state('asc');

	function updateFilter(columnKey, value) {
		filters[columnKey] = value;
		page = 1;
	}

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
		page = 1;
	}

	/**
	 * Get the display value for a unit's column
	 * @param {Object} unit
	 * @param {string} key
	 * @returns {string}
	 */
	function getCellValue(unit, key) {
		if (key === 'residential_unit_type')
			return unit.residential_unit_type?.residential_unit_type ?? '';
		if (key === 'status') return unit.status?.status ?? '';
		return unit[key] ?? '';
	}

	// Filter → Sort → Paginate
	const filteredUnits = $derived.by(() => {
		return residentialUnits.filter((unit) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				const cellValue = String(getCellValue(unit, key)).toLowerCase();
				return cellValue.includes(filterValue.toLowerCase());
			});
		});
	});

	const sortedUnits = $derived.by(() => {
		if (!sortColumn) return filteredUnits;
		return [...filteredUnits].sort((a, b) => {
			const aVal = String(getCellValue(a, sortColumn)).toLowerCase();
			const bVal = String(getCellValue(b, sortColumn)).toLowerCase();
			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	});

	const start = $derived((page - 1) * size);
	const end = $derived(start + size);
	const paginatedUnits = $derived(sortedUnits.slice(start, end));
	const totalPages = $derived(Math.ceil(sortedUnits.length / size) || 1);

	function navigateToUnit(unitUuid) {
		goto(`/address/${projectId}/${addressUuid}/unit/${unitUuid}`);
	}

	function confirmDelete(event, unitUuid) {
		event.stopPropagation();
		deletingUnitUuid = unitUuid;
		deleteMessageBox.open();
	}

	async function handleDelete() {
		if (!deletingUnitUuid) return;

		const formData = new FormData();
		formData.append('unit_uuid', deletingUnitUuid);

		try {
			const response = await fetch('?/deleteResidentialUnit', {
				method: 'POST',
				body: formData
			});
			const result = deserialize(await response.text());

			if (result.type === 'success') {
				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_deleting_residential_unit()
				});
				invalidateAll();
			} else {
				globalToaster.error({
					title: m.common_error(),
					description: result.data?.message || m.message_error_deleting_residential_unit()
				});
			}
		} catch (error) {
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_residential_unit()
			});
		} finally {
			deletingUnitUuid = null;
		}
	}
</script>

<div class="card p-6 sm:p-8 space-y-6">
	<div class="flex items-center gap-2.5 pb-3 border-b border-surface-200-800">
		<IconUsers class="size-5 text-primary-500" />
		<h2 class="text-xl font-semibold">{m.section_residential_units()}</h2>
		{#if residentialUnits.length > 0}
			<span class="badge preset-tonal-primary text-xs ml-auto"
				>{sortedUnits.length === residentialUnits.length
					? residentialUnits.length
					: `${sortedUnits.length} / ${residentialUnits.length}`}</span
			>
		{/if}
		<div class="ml-2">
			<ResidentialUnitModal {residentialUnitTypes} {residentialUnitStatuses} bind:openModal />
		</div>
	</div>

	{#if residentialUnits.length > 0}
		<div class="overflow-x-auto -mx-2">
			<table class="table">
				<thead>
					<tr>
						{#each columnConfig as column (column.key)}
							<th
								class="text-xs font-medium text-surface-900-100 uppercase tracking-wider {column.sortable
									? 'cursor-pointer select-none'
									: ''}"
								onclick={() => column.sortable && toggleSort(column.key)}
							>
								<span class="inline-flex items-center gap-1">
									{column.label}
									{#if column.sortable && sortColumn === column.key}
										{#if sortDirection === 'asc'}
											<IconChevronUp class="size-3" />
										{:else}
											<IconChevronDown class="size-3" />
										{/if}
									{/if}
								</span>
							</th>
						{/each}
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider">
							{m.form_actions()}
						</th>
					</tr>
					<!-- Filter Row -->
					<tr class="bg-surface-50-900">
						{#each columnConfig as column (column.key)}
							<th class="p-1">
								{#if column.filterable}
									<input
										type="text"
										class="input text-sm py-1 px-2 w-full"
										placeholder={m.common_search()}
										value={filters[column.key]}
										oninput={(e) => updateFilter(column.key, e.target.value)}
									/>
								{/if}
							</th>
						{/each}
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedUnits as unit (unit.uuid)}
						<tr
							class="hover:preset-tonal-primary transition-colors cursor-pointer"
							onclick={() => navigateToUnit(unit.uuid)}
						>
							{#each columnConfig as column (column.key)}
								<td>{getCellValue(unit, column.key) || '-'}</td>
							{/each}
							<td>
								<button
									onclick={(e) => confirmDelete(e, unit.uuid)}
									class="btn btn-sm preset-filled-error-500"
									title={m.action_delete()}
								>
									<IconTrash class="size-4" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if totalPages > 1}
			<div class="mt-4 flex justify-center">
				<Pagination
					count={sortedUnits.length}
					pageSize={size}
					{page}
					onPageChange={(event) => (page = event.page)}
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
		{/if}
	{:else}
		<div class="rounded-lg border border-dashed border-surface-300-700 p-10 text-center">
			<IconUsers class="size-16 mx-auto mb-4 text-surface-300 opacity-40" />
			<p class="text-sm font-medium text-surface-500">{m.message_no_residential_units()}</p>
		</div>
	{/if}
</div>

<MessageBox
	bind:this={deleteMessageBox}
	heading={m.common_confirm_delete()}
	message={m.message_confirm_delete_residential_unit()}
	showAcceptButton={true}
	acceptText={m.action_delete()}
	closeText={m.common_cancel()}
	onAccept={handleDelete}
/>
