<script>
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
	let page = $state(1);
	let size = $state(10);

	const start = $derived((page - 1) * size);
	const end = $derived(start + size);
	const slicedSource = $derived(data.slice(start, end));
	const totalPages = $derived(Math.ceil(data.length / size) || 1);
</script>

<div class="table-wrap">
	<div class="overflow-x-auto">
		<table class="table caption-bottom">
			<thead>
				<tr>
					<th>{m.form_project({ count: data.length })}</th>
					<th>{m.common_description()}</th>
					<th>{m.common_active()}</th>
				</tr>
			</thead>
			<tbody class="[&>tr]:hover:preset-tonal-primary">
				{#each slicedSource as row}
					<tr>
						<td>{row.project}</td>
						<td>{row.description}</td>
						<td>{row.active ? m.common_yes() : m.common_no()}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if totalPages > 1}
		<div class="mt-4 flex justify-center">
			<Pagination
				count={data.length}
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
</div>
