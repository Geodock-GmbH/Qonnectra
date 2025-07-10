<script>
	// Skeleton
	import { Pagination, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Tabler
	import { IconTrash } from '@tabler/icons-svelte';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';
	import FlagCombobox from '$lib/components/FlagCombobox.svelte';
	import MessageBox from '$lib/components/MessageBox.svelte';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let {
		projectId,
		searchTerm = '',
		rowData = $bindable(),
		rowClickedSignal = $bindable(false),
		updatedPipeData = null
	} = $props();

	let pipes = $state([]);
	let pipesError = $state(null);
	let loading = $state(false);
	let page = $state(1);
	let size = $state(100);
	let count = $derived(size);
	let deletingIds = $state(new Set());
	const slicedSource = $derived(pipes.slice((page - 1) * size, page * size));
	let lastUpdateId = null;
	let headers = [
		m.name(),
		m.conduit_type(),
		m.outer_conduit(),
		m.status(),
		m.network_level(),
		m.owner(),
		m.constructor(),
		m.manufacturer(),
		m.date(),
		m.flag()
	];
	let messageBoxConfirm;
	let messageBoxAlert;
	let pendingDeleteId = $state(null);

	async function fetchPipes() {
		if (!projectId) {
			return;
		}

		loading = true;
		pipesError = null;

		try {
			let url = `${PUBLIC_API_URL}conduit/all/?project=${projectId}`;
			if (searchTerm) {
				url += `&search=${searchTerm}`;
			}
			let response = await fetch(url, { credentials: 'include' });

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			pipes = data.map((item) => ({
				value: item.uuid,
				name: item.name,
				conduit_type: item.conduit_type.conduit_type,
				outer_conduit: item.outer_conduit,
				status: item.status ? item.status.status : '',
				network_level: item.network_level ? item.network_level.network_level : '',
				owner: item.owner ? item.owner.company : '',
				constructor: item.constructor ? item.constructor.company : '',
				manufacturer: item.manufacturer ? item.manufacturer.company : '',
				date: item.date,
				flag: item.flag.flag
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

	function handleRowClick(pipe) {
		rowData = pipe;
		rowClickedSignal = true;
	}

	async function handleDelete(pipeId) {
		// Store the pipe ID and show confirmation
		pendingDeleteId = pipeId;
		messageBoxConfirm.open();
	}

	async function confirmDelete() {
		if (!pendingDeleteId) return;

		const pipeId = pendingDeleteId;
		pendingDeleteId = null;

		// Check if the conduit is in use
		try {
			const response = await fetch(
				`${PUBLIC_API_URL}trench_conduit_connection/all/?uuid_conduit=${pipeId}`,
				{
					method: 'GET',
					credentials: 'include'
				}
			);

			if (response.ok) {
				const data = await response.json();
				if (data.length > 0) {
					// Store the pipe ID again for potential force delete
					pendingDeleteId = pipeId;
					messageBoxAlert.open();
					return;
				}
			} else {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error('Delete error:', error);
			return;
		}

		// If we get here, conduit is not in use, proceed with delete
		await performDelete(pipeId);
	}

	async function forceDelete() {
		if (!pendingDeleteId) return;

		const pipeId = pendingDeleteId;
		pendingDeleteId = null;

		await performDelete(pipeId);
	}

	async function performDelete(pipeId) {
		// Delete the conduit
		deletingIds.add(pipeId);
		deletingIds = new Set(deletingIds); // Trigger reactivity

		try {
			const response = await fetch(`${PUBLIC_API_URL}conduit/${pipeId}/`, {
				method: 'DELETE',
				headers: {
					'X-CSRFToken': document.cookie
						.split('; ')
						.find((row) => row.startsWith('csrftoken='))
						?.split('=')[1]
				},
				credentials: 'include'
			});

			if (response.ok) {
				// Remove from local state immediately
				pipes = pipes.filter((pipe) => pipe.value !== pipeId);

				toaster.create({
					type: 'success',
					title: m.title_login_success(),
					description: m.success_deleting_conduit()
				});
			} else {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error('Delete error:', error);
			toaster.create({
				type: 'error',
				title: m.error(),
				description: m.error_deleting_conduit()
			});
		} finally {
			deletingIds.delete(pipeId);
			deletingIds = new Set(deletingIds); // Trigger reactivity
		}
	}

	$effect(() => {
		if (projectId) {
			fetchPipes();
		}
	});

	$effect(() => {
		if (searchTerm !== undefined) {
			fetchPipes();
		}
	});

	$effect(() => {
		if (updatedPipeData && updatedPipeData._updateId !== lastUpdateId) {
			const index = pipes.findIndex((p) => p.value === updatedPipeData.uuid);
			const formattedPipe = {
				value: updatedPipeData.uuid,
				name: updatedPipeData.name,
				conduit_type: updatedPipeData.conduit_type.conduit_type,
				outer_conduit: updatedPipeData.outer_conduit,
				status: updatedPipeData.status ? updatedPipeData.status.status : '',
				network_level: updatedPipeData.network_level
					? updatedPipeData.network_level.network_level
					: '',
				owner: updatedPipeData.owner ? updatedPipeData.owner.company : '',
				constructor: updatedPipeData.constructor ? updatedPipeData.constructor.company : '',
				manufacturer: updatedPipeData.manufacturer ? updatedPipeData.manufacturer.company : '',
				date: updatedPipeData.date,
				flag: updatedPipeData.flag.flag
			};
			if (index !== -1) {
				// Update existing pipe
				pipes[index] = formattedPipe;
			} else {
				// Add new pipe
				pipes = [formattedPipe, ...pipes];
			}
			lastUpdateId = updatedPipeData._updateId;
		}
	});
</script>

<Toaster {toaster} />

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
			{#if loading}
				{#each { length: size } as _}
					<tr>
						{#each { length: 10 } as _}
							<td>
								<div class="h-4 bg-surface-500 rounded animate-pulse w-3/4"></div>
							</td>
						{/each}
					</tr>
				{/each}
			{:else}
				{#each slicedSource as row}
					<tr>
						<td data-label={m.name()} onclick={() => handleRowClick(row)}>{row.name}</td>
						<td data-label={m.conduit_type()} onclick={() => handleRowClick(row)}
							>{row.conduit_type}</td
						>
						<td data-label={m.outer_conduit()} onclick={() => handleRowClick(row)}
							>{row.outer_conduit}</td
						>
						<td data-label={m.status()} onclick={() => handleRowClick(row)}>{row.status}</td>
						<td data-label={m.network_level()} onclick={() => handleRowClick(row)}
							>{row.network_level}</td
						>
						<td data-label={m.owner()} onclick={() => handleRowClick(row)}>{row.owner}</td>
						<td data-label={m.constructor()} onclick={() => handleRowClick(row)}
							>{row.constructor}</td
						>
						<td data-label={m.manufacturer()} onclick={() => handleRowClick(row)}
							>{row.manufacturer}</td
						>
						<td data-label={m.date()} onclick={() => handleRowClick(row)}>{row.date}</td>
						<td data-label={m.flag()} onclick={() => handleRowClick(row)}>{row.flag}</td>
						<td data-label="delete">
							<button
								name="delete-pipe"
								class="btn btn-sm variant-filled-error"
								onclick={() => handleDelete(row.value)}
								disabled={deletingIds.has(row.value)}
							>
								{#if deletingIds.has(row.value)}
									<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
								{:else}
									<IconTrash />
								{/if}
							</button>
						</td>
					</tr>
				{/each}
			{/if}
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
/>

<MessageBox
	bind:this={messageBoxConfirm}
	heading={m.confirm ? m.confirm() : 'Confirm'}
	message={m.confirm_delete_conduit
		? m.confirm_delete_conduit()
		: 'Are you sure you want to delete this conduit?'}
	showAcceptButton={true}
	acceptText={m.delete ? m.delete() : 'Delete'}
	onAccept={confirmDelete}
/>
<MessageBox
	bind:this={messageBoxAlert}
	heading={m.confirm()}
	message={m.confirm_delete_conduit_description()}
	showAcceptButton={true}
	acceptText={m.delete ? m.delete() : 'Delete'}
	onAccept={forceDelete}
/>
