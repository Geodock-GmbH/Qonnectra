<script>
	import { getContext } from 'svelte';

	import { m } from '$lib/paraglide/messages';

	let { microducts = [], loading = false, error = null, onMicroductUpdate = null } = $props();

	const nodeAssignmentManager = getContext('nodeAssignmentManager');
	const isAssignMode = $derived(nodeAssignmentManager?.isAssignMode || false);

	/**
	 * Handle the assign click event
	 * @param {Object} microduct - The microduct object
	 */
	function handleAssignClick(microduct) {
		if (!nodeAssignmentManager) {
			console.error('NodeAssignmentManager not found in context');
			return;
		}

		nodeAssignmentManager.activateAssignMode(microduct.uuid, (updatedData) => {
			if (onMicroductUpdate && updatedData?.microduct) {
				onMicroductUpdate(updatedData.microduct);
			}
		});
	}

	/**
	 * Handle the remove click event
	 * @param {Object} microduct - The microduct object
	 */
	function handleRemoveClick(microduct) {
		if (!nodeAssignmentManager) {
			console.error('NodeAssignmentManager not found in context');
			return;
		}

		nodeAssignmentManager.removeNodeFromMicroduct(microduct.uuid, (updatedData) => {
			if (onMicroductUpdate && updatedData?.microduct) {
				onMicroductUpdate(updatedData.microduct);
			}
		});
	}
</script>

{#if loading}
	<div class="p-4">
		<div class="placeholder animate-pulse min-h-6"></div>
	</div>
{:else if error}
	<div class="p-4 preset-filled-error-500 border rounded-lg">
		<p>{error}</p>
	</div>
{:else if microducts.length === 0}
	<div class="p-4 text-surface-600-400">
		<p>{m.form_no_microducts_available()}</p>
	</div>
{:else}
	<div class="table-container">
		<table class="table table-hover">
			<thead>
				<tr>
					<th>{m.form_number()}</th>
					<th>{m.form_color()}</th>
					<th>{m.form_address({ count: 1 })}</th>
				</tr>
			</thead>
			<tbody class="[&>tr]:hover:preset-tonal-primary">
				{#each microducts as microduct (microduct.uuid)}
					<tr>
						<td>{microduct.number}</td>
						<td>
							<div class="flex items-center gap-2">
								<div
									class="w-4 h-4 rounded-full border border-surface-300"
									style="background-color: {microduct.hex_code}"
								></div>
								<span>{microduct.color}</span>
							</div>
						</td>
						<td>
							{#if microduct.uuid_node?.properties?.uuid_address?.properties}
								{@const props = microduct.uuid_node.properties.uuid_address.properties}
								{props.street}
								{props.housenumber}{props.house_number_suffix}{#if !props.house_number_suffix},{/if}{#if props.house_number_suffix},{/if}
								{props.zip_code}
								{props.city}
							{:else}
								<span></span>
							{/if}
						</td>
						<td>
							<button
								class="btn btn-sm preset-filled-primary-500"
								onclick={() => handleAssignClick(microduct)}
								disabled={isAssignMode}
								aria-label="Assign node to microduct"
							>
								{m.action_assign()}
							</button>
						</td>
						<td>
							{#if microduct.uuid_node?.properties?.uuid_address?.properties}
								<button
									class="btn btn-sm preset-filled-error-500"
									onclick={() => handleRemoveClick(microduct)}
									disabled={isAssignMode}
									aria-label="Remove node from microduct"
								>
									{m.action_unassign()}
								</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
