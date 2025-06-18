<script>
	// Skeleton
	import { Pagination, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconTrash } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

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
		}
	}

	async function deleteTrench(trenchId) {
		const response = await fetch(`${PUBLIC_API_URL}trench_conduit_connection/${trenchId}/`, {
			method: 'DELETE',
			credentials: 'include'
		});

		if (response.ok) {
			await fetchTrenches();
		} else {
			const errorText = await response.text();
			console.error('Failed to delete trench connection:', response.status, errorText);
			trenchesError = m.error_deleting_trench_connection();
			throw new Error(errorText);
		}
	}

	$effect(() => {
		if (conduitId) {
			fetchTrenches();
		}
	});

	let page = $state(1);
	let size = $state(10);
	const slicedSource = $derived(trenches.slice((page - 1) * size, page * size));
</script>

<Toaster {toaster}></Toaster>

<!-- Table -->
<div class="table-wrap">
	<table class="table table-fixed caption-bottom">
		<thead>
			<tr>
				<th>Trassen-ID</th>
			</tr>
		</thead>
		<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
			{#each slicedSource as row}
				<tr>
					<td>{row.label}</td>
					<td class="text-right">
						<button
							class="btn"
							onclick={(e) => {
								e.stopPropagation();
								toaster.promise(deleteTrench(row.value), {
									loading: {
										description: m.please_wait()
									},
									success: {
										description: m.trench_connection_deleted()
									},
									error: {
										description: m.error_deleting_trench_connection()
									}
								});
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
