<script>
	// Skeleton
	import { Pagination } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconTrash } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';

	let { conduitId } = $props();

	let trenches = $state([]);
	let trenchesError = $state(null);
	let loading = $state(false);

	async function fetchTrenches() {
		if (!conduitId) {
			// conduitsError = m.select_conduit_first();
			return;
		}

		loading = true;
		trenchesError = null;

		try {
			const response = await fetch(
				`${PUBLIC_API_URL}trench_conduit_connection/?uuid_conduit=${conduitId}`,
				{ credentials: 'include' }
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			trenches = data.results.map((item) => ({
				value: item.uuid,
				label: item.trench.properties.id_trench
			}));
		} catch (error) {
			trenchesError = m.error_fetching_trenches();
		} finally {
			loading = false;
			console.log('trenches', trenches);
		}
	}

	// TODO: Fetch data from API based on conduitId
	$effect(() => {
		if (conduitId) {
			console.log('Fetching trenches for conduit:', conduitId);
			fetchTrenches();
		}
	});

	// Test
	let testData = [
		{ id: 1, name: 'Trasse 1' },
		{ id: 2, name: 'Trasse 2' },
		{ id: 3, name: 'Trasse 3' },
		{ id: 4, name: 'Trasse 4' },
		{ id: 5, name: 'Trasse 5' },
		{ id: 6, name: 'Trasse 6' },
		{ id: 7, name: 'Trasse 7' },
		{ id: 8, name: 'Trasse 8' },
		{ id: 9, name: 'Trasse 9' },
		{ id: 10, name: 'Trasse 10' },
		{ id: 11, name: 'Trasse 11' },
		{ id: 12, name: 'Trasse 12' },
		{ id: 13, name: 'Trasse 13' },
		{ id: 14, name: 'Trasse 14' },
		{ id: 15, name: 'Trasse 15' },
		{ id: 16, name: 'Trasse 16' },
		{ id: 17, name: 'Trasse 17' },
		{ id: 18, name: 'Trasse 18' },
		{ id: 19, name: 'Trasse 19' },
		{ id: 20, name: 'Trasse 20' },
		{ id: 21, name: 'Trasse 21' },
		{ id: 22, name: 'Trasse 22' },
		{ id: 23, name: 'Trasse 23' },
		{ id: 24, name: 'Trasse 24' }
	];
	let page = $state(1);
	let size = $state(10);
	const slicedSource = $derived(trenches.slice((page - 1) * size, page * size));

	function handleRowClick(event) {
		console.log('Row clicked:', event.target);
	}
</script>

<!-- Table -->
<div class="table-wrap">
	<table class="table table-fixed caption-bottom">
		<thead>
			<tr>
				<th>Trassen-ID</th>
				<th class="!text-right">Symbol</th>
			</tr>
		</thead>
		<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
			{#each slicedSource as row}
				<tr
					class="cursor-pointer"
					role="button"
					tabindex="0"
					onclick={() => handleRowClick(row)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') handleRowClick(row);
					}}
				>
					<td>{row.label}</td>
					<td class="text-right">
						<button
							class="btn"
							onclick={(e) => {
								e.stopPropagation();
								// TODO: Handle delete
								console.log('delete', row.id);
							}}
						>
							<IconTrash />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<Pagination
	data={trenches}
	bind:page
	onPageChange={(e) => (page = e.page)}
	bind:pageSize={size}
	onPageSizeChange={(e) => (size = e.pageSize)}
	siblingCount={4}
	alternative
/>
