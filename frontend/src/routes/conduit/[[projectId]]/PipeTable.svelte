<script>
	// Skeleton
	import { Pagination } from '@skeletonlabs/skeleton-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Tabler
	import { IconTrash } from '@tabler/icons-svelte';

	// Svelte
	import { PUBLIC_API_URL } from '$env/static/public';
	import MessageBox from '$lib/components/MessageBox.svelte';
	import { globalToaster } from '$lib/stores/toaster';

	let {
		pipes,
		rowData = $bindable(),
		rowClickedSignal = $bindable(false),
		updatedPipeData = null
	} = $props();

	let pipesError = $state(null);
	let page = $state(1);
	let size = $state(100);
	let count = $derived(size);
	let deletingIds = $state(new Set());
	const slicedSource = $derived(pipes.slice((page - 1) * size, page * size));
	let lastUpdateId = null;
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
	let messageBoxConfirm;
	let messageBoxAlert;
	let pendingDeleteId = $state(null);

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

				globalToaster.success({
					title: m.title_success(),
					description: m.message_success_deleting_conduit()
				});
			} else {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error('Delete error:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_conduit()
			});
		} finally {
			deletingIds.delete(pipeId);
			deletingIds = new Set(deletingIds); // Trigger reactivity
		}
	}

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
				// Update existing pipe - create new array to trigger reactivity
				pipes = [...pipes.slice(0, index), formattedPipe, ...pipes.slice(index + 1)];
			} else {
				// Add new pipe
				pipes = [formattedPipe, ...pipes];
			}
			lastUpdateId = updatedPipeData._updateId;
		}
	});
</script>

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
					<tr>
						<td data-label={m.common_name()} onclick={() => handleRowClick(row)}>{row.name}</td>
						<td data-label={m.form_conduit_type()} onclick={() => handleRowClick(row)}
							>{row.conduit_type}</td
						>
						<td data-label={m.form_outer_conduit()} onclick={() => handleRowClick(row)}
							>{row.outer_conduit}</td
						>
						<td data-label={m.form_status()} onclick={() => handleRowClick(row)}>{row.status}</td>
						<td data-label={m.form_network_level()} onclick={() => handleRowClick(row)}
							>{row.network_level}</td
						>
						<td data-label={m.form_owner()} onclick={() => handleRowClick(row)}>{row.owner}</td>
						<td data-label={m.form_constructor()} onclick={() => handleRowClick(row)}
							>{row.constructor}</td
						>
						<td data-label={m.form_manufacturer()} onclick={() => handleRowClick(row)}
							>{row.manufacturer}</td
						>
						<td data-label={m.common_date()} onclick={() => handleRowClick(row)}>{row.date}</td>
						<td data-label={m.form_flag()} onclick={() => handleRowClick(row)}>{row.flag}</td>
						<td data-label="delete">
							<button
								name="delete-pipe"
								class="btn btn-sm variant-filled-error"
								aria-label="Delete"
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
				<button
					name="delete-pipe"
					class="btn btn-sm variant-filled-error flex-shrink-0 ml-2"
					aria-label="Delete"
					onclick={(e) => {
						e.stopPropagation();
						handleDelete(row.value);
					}}
					disabled={deletingIds.has(row.value)}
				>
					{#if deletingIds.has(row.value)}
						<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
					{:else}
						<IconTrash size={28} class="touch-manipulation" />
					{/if}
				</button>
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
	heading={m.common_confirm()}
	message={m.message_confirm_delete_conduit()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={confirmDelete}
/>
<MessageBox
	bind:this={messageBoxAlert}
	heading={m.common_confirm()}
	message={m.message_confirm_delete_conduit_description()}
	showAcceptButton={true}
	acceptText={m.common_delete()}
	onAccept={forceDelete}
/>
