<script>
	import { deserialize } from '$app/forms';
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	import { IconArrowLeft, IconArrowRight, IconTrash } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { selectedFlag } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	let { projectId, conduitId, onTrenchClick, onTrenchesChange } = $props();

	let trenches = $state([]);
	let trenchesError = $state(null);
	let loading = $state(false);
	let page = $state(1);
	let size = $state(10);
	let count = $derived(size);
	let deletingIds = $state(new Set());
	const slicedSource = $derived(trenches.slice((page - 1) * size, page * size));

	/**
	 * Fetches trench connections for the selected conduit
	 */
	async function fetchTrenches() {
		if (!conduitId) {
			return;
		}

		loading = true;
		trenchesError = null;

		try {
			const formData = new FormData();
			formData.append('conduitId', conduitId);

			const response = await fetch('?/getTrenchConnections', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch trenches');
			}

			trenches = result.data?.trenches || [];
		} catch (error) {
			trenchesError = m.message_error_fetching_trenches();
			console.error('Error fetching trenches:', error);
		} finally {
			loading = false;
			updateCount();
			// Notify parent of trenches change for linked trenches highlight
			onTrenchesChange?.(trenches);
		}
	}

	/**
	 * Deletes a trench connection by ID
	 * @param {string} connectionId - UUID of the connection to delete
	 */
	async function deleteTrench(connectionId) {
		const formData = new FormData();
		formData.append('connectionId', connectionId);

		const response = await fetch('?/deleteTrenchConnection', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			console.error('Failed to delete trench connection:', result.data?.error);
			globalToaster.error({
				description: m.message_error_deleting_trench_connection()
			});
			throw new Error(result.data?.error);
		}

		await fetchTrenches();
	}

	/**
	 * Handles deletion of a trench connection with loading state management
	 * @param {string} trenchId - UUID of the trench connection to delete
	 */
	function handleDelete(trenchId) {
		if (deletingIds.has(trenchId)) return;

		deletingIds.add(trenchId);

		const promise = deleteTrench(trenchId).finally(() => {
			deletingIds.delete(trenchId);
		});

		globalToaster.promise(promise, {
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

	/**
	 * Saves a new trench connection for the selected conduit
	 * @param {string} trenchId - UUID of the trench to connect
	 */
	async function saveTrenchConnection(trenchId) {
		const formData = new FormData();
		formData.append('conduitId', conduitId[0]);
		formData.append('trenchId', trenchId);

		const response = await fetch('?/createTrenchConnection', {
			method: 'POST',
			body: formData
		});

		const result = deserialize(await response.text());

		if (result.type === 'failure' || result.type === 'error') {
			console.error('Failed to save trench connection:', result.data?.error);
			throw new Error(result.data?.error);
		}
	}

	/**
	 * Clears the trench table data
	 */
	function emptyTable() {
		trenches = [];
		trenchesError = null;
		loading = false;
	}

	/**
	 * Updates the count derived value based on current trenches
	 */
	function updateCount() {
		count = trenches.length;
	}

	/**
	 * Adds routed trenches to the table, creating connections for new trenches
	 * @param {Array<{value: string, label: string}>} routedTrenches - Array of trench objects to add
	 */
	export async function addRoutedTrenches(routedTrenches) {
		if (!routedTrenches?.length) return;

		const existingTrenchValues = new Set(trenches.map((t) => t.trench));
		const newTrenches = routedTrenches.filter((t) => !existingTrenchValues.has(t.value));

		if (newTrenches.length > 0) {
			const savePromises = newTrenches.map((trench) => saveTrenchConnection(trench.value));

			await Promise.all(savePromises);
			fetchTrenches();
			globalToaster.success({
				description: m.message_trench_connection_saved()
			});
		} else {
			globalToaster.warning({
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
