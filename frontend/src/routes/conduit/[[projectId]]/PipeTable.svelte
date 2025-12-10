<script>
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import { drawerStore } from '$lib/stores/drawer';
	import { globalToaster } from '$lib/stores/toaster';

	import ConduitDrawerTabs from './ConduitDrawerTabs.svelte';

	let { pipes, onConduitUpdate = () => {}, onConduitDelete = () => {} } = $props();

	let page = $state(1);
	let size = $state(20);
	const slicedSource = $derived(pipes.slice((page - 1) * size, page * size));
	let headers = [
		m.common_name(),
		m.form_conduit_type(),
		m.form_outer_conduit(),
		m.form_status(),
		m.form_network_level(),
		m.form_owner(),
		m.form_constructor(),
		m.form_manufacturer(),
		m.common_date(),
		m.form_flag()
	];

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
						<tr>
							{#each headers as header}
								<th>{header}</th>
							{/each}
						</tr>
					</thead>
					<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
						{#each slicedSource as row}
							<tr onclick={() => handleRowClick(row)}>
								<td data-label={m.common_name()}>{row.name}</td>
								<td data-label={m.form_conduit_type()}>{row.conduit_type}</td>
								<td data-label={m.form_outer_conduit()}>{row.outer_conduit}</td>
								<td data-label={m.form_status()}>{row.status}</td>
								<td data-label={m.form_network_level()}>{row.network_level}</td>
								<td data-label={m.form_owner()}>{row.owner}</td>
								<td data-label={m.form_constructor()}>{row.constructor}</td>
								<td data-label={m.form_manufacturer()}>{row.manufacturer}</td>
								<td data-label={m.common_date()}>{row.date}</td>
								<td data-label={m.form_flag()}>{row.flag}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Mobile Card View -->
		<div class="md:hidden space-y-3">
			{#each slicedSource as row}
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
			{/each}
		</div>
	</div>

	<!-- Fixed pagination at bottom -->
	<div class="flex-shrink-0 pt-4">
	<Pagination
		data={pipes}
		{page}
		onPageChange={(e) => (page = e.page)}
		pageSize={size}
		onPageSizeChange={(e) => (size = e.pageSize)}
		siblingCount={4}
		alternative
		count={pipes.length}
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
