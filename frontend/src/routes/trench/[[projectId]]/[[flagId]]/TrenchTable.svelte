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
		placement: 'bottom-end',
		id: 'trench-table-toaster'
	});

	let { projectId, conduitId, onTrenchClick } = $props();

	let trenches = $state([]);
	let trenchesError = $state(null);
	let loading = $state(false);
	let page = $state(1);
	let size = $state(10);
	let count = $derived(size);
	let deletingIds = $state(new Set());
	const slicedSource = $derived(trenches.slice((page - 1) * size, page * size));

	async function fetchTrenches() {
		if (!conduitId) {
			return;
		}

		loading = true;
		trenchesError = null;

		try {
			let url = `${PUBLIC_API_URL}trench_conduit_connection/all/?uuid_conduit=${conduitId}`;
			let response = await fetch(url, { credentials: 'include' });

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			trenches = data.map((item) => ({
				value: item.uuid,
				label: item.trench.properties.id_trench,
				trench: item.trench.id
			}));
		} catch (error) {
			trenchesError = m.message_error_fetching_trenches();
		} finally {
			loading = false;
			updateCount();
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
			toaster.error({
				description: m.message_error_deleting_trench_connection()
			});
			throw new Error(errorText);
		}
	}

	function handleDelete(trenchId) {
		if (deletingIds.has(trenchId)) return;

		deletingIds.add(trenchId);

		const promise = deleteTrench(trenchId).finally(() => {
			deletingIds.delete(trenchId);
		});

		toaster.promise(promise, {
			loading: {
				description: m.message_please_wait()
			},
			success: {
				description: m.message_trench_connection_deleted()
			},
			error: {
				description: m.message_error_deleting_trench_connection()
			}
		});
	}

	async function saveTrenchConnection(trenchId) {
		const response = await fetch(`${PUBLIC_API_URL}trench_conduit_connection/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				uuid_conduit: conduitId[0],
				uuid_trench: trenchId
			}),
			credentials: 'include'
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Failed to save trench connection:', response.status, errorText);
			throw new Error(errorText);
		}
	}

	function emptyTable() {
		trenches = [];
		trenchesError = null;
		loading = false;
	}

	function updateCount() {
		count = trenches.length;
	}

	export async function addRoutedTrenches(routedTrenches) {
		if (!routedTrenches?.length) return;

		const existingTrenchValues = new Set(trenches.map((t) => t.trench));
		const newTrenches = routedTrenches.filter((t) => !existingTrenchValues.has(t.value));

		if (newTrenches.length > 0) {
			const savePromises = newTrenches.map((trench) => saveTrenchConnection(trench.value));

			await Promise.all(savePromises);
			fetchTrenches();
			toaster.create({
				type: 'success',
				description: m.message_trench_connection_saved()
			});
		} else {
			toaster.create({
				type: 'warning',
				description: m.message_no_new_trench_connections()
			});
		}
	}

	$effect(() => {
		if (conduitId) {
			fetchTrenches();
		} else if (selectedFlag) {
			emptyTable();
		}
	});

	$effect(() => {
		if (projectId) {
			emptyTable();
		}
	});

	$effect(() => {
		if (count <= size) {
			page = 1;
		}
	});
</script>

<Toaster {toaster}></Toaster>

<div class="table-wrap">
	<div class="overflow-x-auto">
		<table class="table table-fixed caption-bottom w-full">
			<thead>
				<tr>
					<th class="text-left">{m.form_trench_id()}</th>
				</tr>
			</thead>
			<tbody class="[&>tr]:hover:preset-tonal-primary cursor-pointer">
				{#each slicedSource as row}
					<tr onclick={() => onTrenchClick?.(row.value, row.label)} class="touch-manipulation">
						<td class="py-3 px-2">{row.label}</td>
						<td class="text-right py-3 px-2">
							<button
								class="btn btn-sm touch-manipulation"
								disabled={deletingIds.has(row.value)}
								onclick={(e) => {
									e.stopPropagation();
									handleDelete(row.value);
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

	<div class="mt-4">
		<Pagination
			data={trenches}
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
