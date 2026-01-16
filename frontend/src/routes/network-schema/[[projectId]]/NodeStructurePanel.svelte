<script>
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';

	import { m } from '$lib/paraglide/messages';

	import { globalToaster } from '$lib/stores/toaster';

	let { nodeUuid, nodeName = '', initialSlotConfigUuid = null, sharedSlotState = null } = $props();

	// State
	let localSlotConfigurations = $state([]);
	let selectedSlotConfigUuid = $state(initialSlotConfigUuid);
	let structures = $state([]);
	let loading = $state(true);
	let loadingStructures = $state(false);

	// Update selection when initialSlotConfigUuid prop changes (e.g., when opening from a specific slot item)
	$effect(() => {
		if (initialSlotConfigUuid) {
			selectedSlotConfigUuid = initialSlotConfigUuid;
		}
	});

	// Use shared state if available, otherwise use local state
	const slotConfigurations = $derived(
		sharedSlotState?.slotConfigurations?.length > 0
			? sharedSlotState.slotConfigurations
			: localSlotConfigurations
	);

	// Derived
	const selectedConfig = $derived(
		slotConfigurations.find((c) => c.uuid === selectedSlotConfigUuid)
	);

	const containerPath = $derived.by(() => {
		if (!selectedConfig?.container) return null;
		// Build breadcrumb path from container hierarchy
		// For now, just return the container display name
		// In the future, we can traverse the parent_container chain
		return selectedConfig.container?.display_name || null;
	});

	const tableRows = $derived.by(() => {
		if (!selectedConfig) return [];

		const totalSlots = selectedConfig.total_slots || 0;
		const rows = [];

		for (let slot = 1; slot <= totalSlots; slot++) {
			// Find structure that contains this slot
			const structure = structures.find((s) => s.slot_start <= slot && s.slot_end >= slot);

			rows.push({
				slotNumber: slot,
				structure: structure || null,
				// Determine if this is the first row of a block
				isBlockStart: structure ? structure.slot_start === slot : false,
				// Determine if this is the last row of a block
				isBlockEnd: structure ? structure.slot_end === slot : false,
				// Block size for rowspan calculation
				blockSize: structure ? structure.slot_end - structure.slot_start + 1 : 1
			});
		}

		return rows;
	});

	// Group rows by structure for visual grouping
	const groupedRows = $derived.by(() => {
		if (!tableRows.length) return [];

		const groups = [];
		let currentGroup = null;

		for (const row of tableRows) {
			const structureUuid = row.structure?.uuid || null;

			if (currentGroup === null || currentGroup.structureUuid !== structureUuid) {
				// Start new group
				currentGroup = {
					structureUuid,
					structure: row.structure,
					rows: [row],
					isOdd: groups.length % 2 === 0
				};
				groups.push(currentGroup);
			} else {
				// Add to current group
				currentGroup.rows.push(row);
			}
		}

		return groups;
	});

	/**
	 * Fetch slot configurations for the node (fallback when shared state not available)
	 */
	async function fetchSlotConfigurations() {
		if (!nodeUuid) return;

		// Skip if we have shared state with data
		if (sharedSlotState?.slotConfigurations?.length > 0) {
			loading = false;
			// Auto-select first configuration if none selected
			if (!selectedSlotConfigUuid && slotConfigurations.length > 0) {
				selectedSlotConfigUuid = slotConfigurations[0].uuid;
			}
			return;
		}

		loading = true;
		try {
			const formData = new FormData();
			formData.append('nodeUuid', nodeUuid);

			const response = await fetch('?/getSlotConfigurationsForNode', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch slot configurations');
			}

			localSlotConfigurations = result.data?.configurations || [];

			// Auto-select first configuration if none selected
			if (!selectedSlotConfigUuid && localSlotConfigurations.length > 0) {
				selectedSlotConfigUuid = localSlotConfigurations[0].uuid;
			}
		} catch (err) {
			console.error('Error fetching slot configurations:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_slot_configurations()
			});
			localSlotConfigurations = [];
		} finally {
			loading = false;
		}
	}

	/**
	 * Fetch structures for the selected slot configuration
	 */
	async function fetchStructures() {
		if (!selectedSlotConfigUuid) {
			structures = [];
			return;
		}

		loadingStructures = true;
		try {
			const formData = new FormData();
			formData.append('slotConfigUuid', selectedSlotConfigUuid);

			const response = await fetch('?/getNodeStructures', {
				method: 'POST',
				body: formData
			});

			const result = deserialize(await response.text());

			if (result.type === 'failure' || result.type === 'error') {
				throw new Error(result.data?.error || 'Failed to fetch structures');
			}

			structures = result.data?.structures || [];
		} catch (err) {
			console.error('Error fetching structures:', err);
			globalToaster.error({
				title: m.common_error(),
				description: m.message_error_fetching_structures()
			});
			structures = [];
		} finally {
			loadingStructures = false;
		}
	}

	/**
	 * Handle side selection change
	 */
	function handleSideChange(e) {
		selectedSlotConfigUuid = e.target.value;
	}

	// Fetch structures when selected config changes
	$effect(() => {
		if (selectedSlotConfigUuid) {
			fetchStructures();
		}
	});

	// React to shared state updates (when slot configs are modified in the other panel)
	$effect(() => {
		const lastUpdated = sharedSlotState?.lastUpdated;
		if (lastUpdated && sharedSlotState?.slotConfigurations?.length > 0) {
			loading = false;
			// Auto-select first config if current selection is no longer valid
			const currentConfigStillExists = sharedSlotState.slotConfigurations.some(
				(c) => c.uuid === selectedSlotConfigUuid
			);
			if (!currentConfigStillExists && sharedSlotState.slotConfigurations.length > 0) {
				selectedSlotConfigUuid = sharedSlotState.slotConfigurations[0].uuid;
			} else if (!selectedSlotConfigUuid && sharedSlotState.slotConfigurations.length > 0) {
				selectedSlotConfigUuid = sharedSlotState.slotConfigurations[0].uuid;
			}
		}
	});

	// Initial fetch
	onMount(() => {
		fetchSlotConfigurations();
	});
</script>

<div class="flex flex-col gap-4 h-full">
	<!-- Header with container info and side selector -->
	<div class="space-y-3">
		{#if containerPath}
			<div class="text-sm text-surface-500">
				<span class="font-medium">{m.form_container_path()}:</span>
				{containerPath}
			</div>
		{/if}

		<div class="flex items-center gap-3">
			<label class="label flex-1">
				<span class="text-sm font-medium">{m.form_select_side()}</span>
				<select class="select" value={selectedSlotConfigUuid} onchange={handleSideChange}>
					{#each slotConfigurations as config (config.uuid)}
						<option value={config.uuid}>{config.side}</option>
					{/each}
				</select>
			</label>

			{#if selectedConfig}
				<div class="text-sm text-surface-500 pt-5">
					{m.form_total_slots()}: {selectedConfig.total_slots}
				</div>
			{/if}
		</div>
	</div>

	<!-- Table -->
	<div class="flex-1 overflow-auto border border-surface-200-800 rounded-lg">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.common_loading()}</span>
			</div>
		{:else if slotConfigurations.length === 0}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.message_no_slot_configurations()}</span>
			</div>
		{:else if loadingStructures}
			<div class="flex items-center justify-center py-8">
				<span class="text-surface-500">{m.common_loading()}</span>
			</div>
		{:else}
			<table class="w-full text-sm">
				<thead class="bg-surface-100-900 sticky top-0">
					<tr>
						<th class="px-3 py-2 text-left font-medium border-b border-surface-200-800 w-16">
							{m.form_tpu()}
						</th>
						<th class="px-3 py-2 text-left font-medium border-b border-surface-200-800">
							{m.form_component_type()}
						</th>
						<th class="px-3 py-2 text-left font-medium border-b border-surface-200-800">
							{m.form_article_number()}
						</th>
						<th class="px-3 py-2 text-left font-medium border-b border-surface-200-800">
							{m.form_usage()}
						</th>
						<th class="px-3 py-2 text-left font-medium border-b border-surface-200-800 w-16">
							{m.form_clip_number()}
						</th>
					</tr>
				</thead>
				<tbody>
					{#each groupedRows as group, groupIndex (group.structureUuid ?? `empty-${groupIndex}`)}
						{#each group.rows as row, rowIndex (row.slotNumber)}
							<tr
								class="border-b border-surface-200-800 last:border-b-0"
								class:bg-surface-50-950={group.isOdd}
								class:bg-surface-100-900={!group.isOdd}
								class:border-t-2={rowIndex === 0 && groupIndex > 0}
								class:border-t-surface-300-700={rowIndex === 0 && groupIndex > 0}
							>
								<!-- TPU (slot number) -->
								<td class="px-3 py-1.5 font-mono text-center">{row.slotNumber}</td>

								<!-- Component Type - only show on first row of block -->
								<td class="px-3 py-1.5">
									{#if row.isBlockStart && row.structure}
										{row.structure.component_type?.component_type || '-'}
									{:else if !row.structure}
										<span class="text-surface-400">-</span>
									{/if}
								</td>

								<!-- Article Number - only show on first row of block -->
								<td class="px-3 py-1.5">
									{#if row.isBlockStart && row.structure}
										{row.structure.component_structure?.article_number || '-'}
									{:else if !row.structure}
										<span class="text-surface-400">-</span>
									{/if}
								</td>

								<!-- Usage/Label - only show on first row of block -->
								<td class="px-3 py-1.5">
									{#if row.isBlockStart && row.structure}
										{row.structure.label || row.structure.purpose || '-'}
									{:else if !row.structure}
										<span class="text-surface-400">-</span>
									{/if}
								</td>

								<!-- Clip Number -->
								<td class="px-3 py-1.5 font-mono text-center">
									{#if row.structure}
										{row.structure.clip_number ?? row.slotNumber}
									{:else}
										<span class="text-surface-400">{row.slotNumber}</span>
									{/if}
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
