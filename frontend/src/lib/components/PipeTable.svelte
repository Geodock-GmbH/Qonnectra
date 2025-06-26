<script>
	// Skeleton
	import { Pagination, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let { projectId } = $props();

	let pipes = $state([]);
	let pipesError = $state(null);
	let loading = $state(false);
	let page = $state(1);
	let size = $state(10);
	let count = $derived(size);
	let deletingIds = $state(new Set());
	const slicedSource = $derived(pipes.slice((page - 1) * size, page * size));

	async function fetchPipes() {
		if (!projectId) {
			return;
		}

		loading = true;
		pipesError = null;

		try {
			let allResults = [];
			let url = `${PUBLIC_API_URL}conduit/?project=${projectId}`;
			while (url) {
				const response = await fetch(url, { credentials: 'include' });

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();
				allResults.push(...data.results);
				url = data.next;
			}

			pipes = allResults.map((item) => ({
				value: item.uuid,
				name: item.name,
				conduit_type: item.conduit_type.conduit_type,
				outer_conduit: item.outer_conduit,
				status: item.status.status,
				network_level: item.network_level.network_level,
				owner: item.owner.company,
				constructor: item.constructor.company,
				manufacturer: item.manufacturer.company,
				date: item.date
			}));
		} catch (error) {
			toaster.create({
				type: 'error',
				title: m.error_fetching_pipes(),
				description: m.error_fetching_pipes_description()
			});
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (projectId) {
			fetchPipes();
		}
	});
</script>

<div class="table-wrap overflow-x-auto">
	<table class="table table-card caption-bottom w-full">
		<thead>
			<tr>
				<th>{m.name()}</th>
				<th>{m.conduit_type()}</th>
				<th>{m.outer_conduit()}</th>
				<th>{m.status()}</th>
				<th>{m.network_level()}</th>
				<th>{m.owner()}</th>
				<th>{m.constructor()}</th>
				<th>{m.manufacturer()}</th>
				<th>{m.date()}</th>
			</tr>
		</thead>
		<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
			{#each slicedSource as row}
				{#if loading}
					<tr>
						{#each { length: 9 } as _}
							<td>
								<div class="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
							</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td data-label={m.name()}>{row.name}</td>
						<td data-label={m.conduit_type()}>{row.conduit_type}</td>
						<td data-label={m.outer_conduit()}>{row.outer_conduit}</td>
						<td data-label={m.status()}>{row.status}</td>
						<td data-label={m.network_level()}>{row.network_level}</td>
						<td data-label={m.owner()}>{row.owner}</td>
						<td data-label={m.constructor()}>{row.constructor}</td>
						<td data-label={m.manufacturer()}>{row.manufacturer}</td>
						<td data-label={m.date()}>{row.date}</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>
<Pagination
	data={pipes}
	{page}
	onPageChange={(e) => (page = e.page)}
	pageSize={size}
	onPageSizeChange={(e) => (size = e.pageSize)}
	siblingCount={4}
	alternative
	{count}
/>
