<script>
	import { deserialize } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { IconArrowLeft, IconArrowRight, IconTrash, IconUsers } from '@tabler/icons-svelte';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';

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

	const start = $derived((page - 1) * size);
	const end = $derived(start + size);
	const paginatedUnits = $derived(residentialUnits.slice(start, end));
	const totalPages = $derived(Math.ceil(residentialUnits.length / size) || 1);

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
			<span class="badge preset-tonal-primary text-xs ml-auto">{residentialUnits.length}</span>
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
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider">
							{m.table_residential_unit_id()}
						</th>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider">
							{m.table_floor()}
						</th>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider">
							{m.table_side()}
						</th>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider">
							{m.table_residential_unit_type()}
						</th>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider">
							{m.table_residential_unit_status()}
						</th>
						<th class="text-xs font-medium text-surface-900-100 uppercase tracking-wider">
							{m.form_actions()}
						</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedUnits as unit (unit.uuid)}
						<tr
							class="hover:preset-tonal-primary transition-colors cursor-pointer"
							onclick={() => navigateToUnit(unit.uuid)}
						>
							<td>{unit.id_residential_unit ?? '-'}</td>
							<td>{unit.floor ?? '-'}</td>
							<td>{unit.side ?? '-'}</td>
							<td>{unit.residential_unit_type?.residential_unit_type ?? '-'}</td>
							<td>{unit.status?.status ?? '-'}</td>
							<td>
								<button
									onclick={(e) => confirmDelete(e, unit.uuid)}
									class="btn btn-sm preset-tonal-error"
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
					count={residentialUnits.length}
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
