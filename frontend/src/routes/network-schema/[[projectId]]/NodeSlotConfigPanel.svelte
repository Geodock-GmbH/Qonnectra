<script>
	import { deserialize } from '$app/forms';
	import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	let { nodeUuid, nodeName = '' } = $props();

	let configurations = $state([]);
	let loading = $state(true);
	let editingUuid = $state(null);
	let isCreating = $state(false);

	let formSide = $state('');
	let formTotalSlots = $state(1);

	/**
	 * Fetches the slot configurations for the node.
	 */
	async function fetchConfigurations() {
		if (!nodeUuid) return;

		loading = true;
		resetForm();
		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);

			const response = await fetch('?/getSlotConfigurations', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch configurations');
			}

			configurations = result.data?.configurations || [];
		} catch (error) {
			console.error('Error fetching slot configurations:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_slot_configurations()
			});
			configurations = [];
		} finally {
			loading = false;
		}
	}

	/**
	 * Re-fetches the slot configurations when the nodeUuid changes.
	 */
	$effect(() => {
		const currentNodeUuid = nodeUuid;
		fetchConfigurations();
	});

	/**
	 * Creates a new slot configuration.
	 */
	async function handleCreate() {
		if (!formSide.trim() || formTotalSlots < 1) return;

		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);
			formData.append('side', formSide.trim());
			formData.append('totalSlots', formTotalSlots.toString());

			const response = await fetch('?/createSlotConfiguration', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to create configuration');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_creating_slot_configuration()
			});
			resetForm();
			await fetchConfigurations();
		} catch (error) {
			console.error('Error creating slot configuration:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_creating_slot_configuration()
			});
		}
	}

	/**
	 * Updates an existing slot configuration.
	 * @param {string} uuid - The UUID of the slot configuration to update.
	 * @returns {Promise<void>}
	 */
	async function handleUpdate(uuid) {
		if (!formSide.trim() || formTotalSlots < 1) return;

		try {
			const formData = new FormData();
			formData.append('configUuid', uuid);
			formData.append('side', formSide.trim());
			formData.append('totalSlots', formTotalSlots.toString());

			const response = await fetch('?/updateSlotConfiguration', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to update configuration');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_updating_slot_configuration()
			});
			resetForm();
			await fetchConfigurations();
		} catch (error) {
			console.error('Error updating slot configuration:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_updating_slot_configuration()
			});
		}
	}

	/**
	 * Deletes a slot configuration.
	 * @param {string} uuid - The UUID of the slot configuration to delete.
	 * @returns {Promise<void>}
	 */
	async function handleDelete(uuid) {
		try {
			const formData = new FormData();
			formData.append('configUuid', uuid);

			const response = await fetch('?/deleteSlotConfiguration', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to delete configuration');
			}

			globalToaster.success({
				title: m.title_success(),
				description: m.message_success_deleting_slot_configuration()
			});
			await fetchConfigurations();
		} catch (error) {
			console.error('Error deleting slot configuration:', error);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_deleting_slot_configuration()
			});
		}
	}

	function startEdit(config) {
		editingUuid = config.uuid;
		formSide = config.side;
		formTotalSlots = config.total_slots;
		isCreating = false;
	}

	function startCreate() {
		isCreating = true;
		editingUuid = null;
		formSide = '';
		formTotalSlots = 1;
	}

	function resetForm() {
		editingUuid = null;
		isCreating = false;
		formSide = '';
		formTotalSlots = 1;
	}

	function handleSubmit() {
		if (isCreating) {
			handleCreate();
		} else if (editingUuid) {
			handleUpdate(editingUuid);
		}
	}
</script>

<!-- Main container -->
<div class="flex flex-col gap-4 h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-600-400">
			{nodeName ? `${m.form_node()}: ${nodeName}` : m.title_slot_configuration()}
		</h3>
		{#if !isCreating && !editingUuid}
			<button type="button" class="btn btn-sm preset-filled-primary-500" onclick={startCreate}>
				<IconPlus size={16} />
				{m.action_add()}
			</button>
		{/if}
	</div>
	<!-- Form for creating or editing a slot configuration -->
	{#if isCreating || editingUuid}
		<div class="card p-4 space-y-3 bg-surface-50-950 border border-surface-200-800">
			<div class="grid grid-cols-2 gap-3">
				<label class="label">
					<span class="text-sm">{m.form_side()}</span>
					<input
						type="text"
						class="input"
						bind:value={formSide}
						placeholder={m.placeholder_slot_side()}
						required
					/>
				</label>
				<label class="label">
					<span class="text-sm">{m.form_total_slots()}</span>
					<input type="number" class="input" bind:value={formTotalSlots} min="1" required />
				</label>
			</div>
			<div class="flex justify-end gap-2">
				<button type="button" class="btn btn-sm preset-outlined" onclick={resetForm}>
					<IconX size={16} />
					{m.common_cancel()}
				</button>
				<button type="button" class="btn btn-sm preset-filled-primary-500" onclick={handleSubmit}>
					<IconCheck size={16} />
					{m.action_save()}
				</button>
			</div>
		</div>
	{/if}

	<!-- List of slot configurations -->
	<div class="flex-1 overflow-auto">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.common_loading()}</span>
			</div>
		{:else if configurations.length === 0}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.message_no_slot_configurations()}</span>
			</div>
		{:else}
			<div class="space-y-2">
				{#each configurations as config (config.uuid)}
					<div
						class="card p-3 flex items-center justify-between bg-surface-50-950 border border-surface-200-800"
					>
						<div class="flex-1">
							<div class="font-medium">{config.side}</div>
							<div class="text-sm text-surface-500">
								{m.form_total_slots()}: {config.total_slots} |
								{m.form_used_slots()}: {config.used_slots ?? 0} |
								{m.form_free_slots()}: {config.free_slots ?? config.total_slots}
							</div>
						</div>
						<div class="flex items-center gap-1">
							<button
								type="button"
								class="btn btn-sm preset-filled-warning-500 p-2"
								onclick={() => startEdit(config)}
								title={m.common_edit()}
							>
								<IconPencil size={16} />
							</button>
							<button
								type="button"
								class="btn btn-sm preset-filled-error-500 p-2"
								onclick={() => handleDelete(config.uuid)}
								title={m.common_delete()}
							>
								<IconTrash size={16} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
