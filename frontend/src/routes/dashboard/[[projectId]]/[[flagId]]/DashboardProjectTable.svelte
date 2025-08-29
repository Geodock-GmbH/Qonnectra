<script>
	// Skeleton
	import { Pagination, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
	let page = $state(1);
	let size = $state(110);
	let count = $derived(data.length);
	const slicedSource = $derived(data.slice((page - 1) * size, page * size));
</script>

<div class="table-wrap">
	<div class="overflow-x-auto">
		<table class="table caption-bottom">
			<thead>
				<tr>
					<th>{m.project()}</th>
					<th>{m.description()}</th>
					<th>{m.active()}</th>
				</tr>
			</thead>
			<tbody class="[&>tr]:hover:preset-tonal-primary">
				{#each slicedSource as row}
					<tr>
						<td>{row.project}</td>
						<td>{row.description}</td>
						<td>{row.active ? m.yes() : m.no()}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			{data}
			{page}
			onPageChange={(e) => (page = e.page)}
			pageSize={size}
			onPageSizeChange={(e) => (size = e.pageSize)}
			siblingCount={2}
			alternative
			{count}
		/>
	</div>
</div>
