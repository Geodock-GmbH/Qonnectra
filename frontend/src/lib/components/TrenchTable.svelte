<script>
	// Skeleton
	import { Pagination, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Tabler
	import { IconTrash } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';
	import { selectedFlag } from '$lib/stores/store';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let { conduitId, routedTrenches } = $props();

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

	function emptyTable() {
		trenches = [];
		trenchesError = null;
		loading = false;
	}

	function addRoutedTrenches() {
		if (!routedTrenches?.length) return;

		// Create a Set of existing trench values for O(1) lookup
		const existingTrenchValues = new Set(trenches.map((t) => t.value));

		// Filter and add only new trenches that don't already exist
		const newTrenches = routedTrenches.filter((t) => !existingTrenchValues.has(t.value));

		if (newTrenches.length > 0) {
			trenches = [...trenches, ...newTrenches];
		}
	}

	$effect(() => {
		if (routedTrenches?.length) {
			addRoutedTrenches();
		}
	});

	$effect(() => {
		if (conduitId) {
			fetchTrenches();
			// TODO: This must also work on project change
		}
		if (selectedFlag) {
			emptyTable();
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
