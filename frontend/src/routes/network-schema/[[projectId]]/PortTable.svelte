<script>
	import { IconArrowMerge, IconArrowsSplit, IconX } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FiberCell from './FiberCell.svelte';

	let {
		structureName = '',
		portRows = [],
		fiberColors = [],
		loading = false,
		onPortDrop = () => {},
		onClearPort = () => {},
		onClose = () => {},
		// Merge functionality props
		mergeSelectionMode = false,
		selectedForMerge = new Set(),
		onToggleMergeMode = () => {},
		onTogglePortSelection = () => {},
		onMergePorts = () => {},
		onUnmergePorts = () => {},
		onMergedPortDrop = () => {}
	} = $props();

	// Color lookup map
	const colorMap = $derived.by(() => {
		const map = new Map();
		for (const color of fiberColors) {
			map.set(color.name_de, color.hex_code);
			map.set(color.name_en, color.hex_code);
		}
		return map;
	});

	function getColorHex(fiberColorName) {
		if (!fiberColorName) return '#999999';
		return colorMap.get(fiberColorName) || '#999999';
	}

	function handlePortDrop(portNumber, side, fiberData) {
		onPortDrop(portNumber, side, fiberData);
	}

	function handleClearPort(portNumber, side) {
		onClearPort(portNumber, side);
	}

	function isPortSelected(portNumber, side) {
		return selectedForMerge.has(`${portNumber}-${side}`);
	}
</script>

<div
	class="port-table-container h-full flex flex-col rounded-xl border border-surface-200-800 bg-surface-100-900 overflow-hidden"
>
	<!-- Header -->
	<div
		class="flex items-center justify-between px-3 py-2 bg-surface-200-800 border-b border-surface-200-800"
	>
		<div class="flex items-center gap-3">
			<div>
				<h4 class="font-semibold text-sm leading-tight">{structureName}</h4>
				<p class="text-[11px] leading-tight text-surface-500">
					{portRows.length}
					{m.form_ports?.() || 'Ports'}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<!-- Merge mode toggle -->
			<button
				type="button"
				class="p-2 rounded-lg transition-colors {mergeSelectionMode
					? 'bg-primary-500 text-white'
					: 'hover:bg-surface-300-700'}"
				onclick={onToggleMergeMode}
				title={m.action_merge_ports?.() || 'Merge ports'}
			>
				<IconArrowMerge size={18} />
			</button>
			<button
				type="button"
				class="p-2 rounded-lg hover:bg-surface-300-700 transition-colors"
				onclick={onClose}
				aria-label={m.common_close?.() || 'Close'}
			>
				<IconX size={18} />
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-8">
			<span class="text-surface-500">{m.common_loading()}</span>
		</div>
	{:else if portRows.length === 0}
		<div class="flex items-center justify-center py-8">
			<span class="text-surface-500">
				{m.message_no_ports?.() || 'No ports configured for this component'}
			</span>
		</div>
	{:else}
		<!-- Column Headers (outside scroll container) -->
		<div
			class="grid {mergeSelectionMode
				? 'grid-cols-[40px_60px_1fr_1fr]'
				: 'grid-cols-[60px_1fr_1fr]'} bg-surface-200-800 border-b border-surface-200-800 text-xs font-semibold uppercase tracking-wide text-surface-500"
		>
			{#if mergeSelectionMode}
				<div class="px-2 py-2.5 text-center">
					<!-- Checkbox column header -->
				</div>
			{/if}
			<div class="px-3 py-2.5 text-center">
				{m.form_port?.() || 'Port'}
			</div>
			<div class="px-3 py-2.5 flex items-center gap-2 border-l border-surface-200-800">
				{m.form_fiber_a?.() || 'Faser A'} (IN)
			</div>
			<div class="px-3 py-2.5 flex items-center gap-2 border-l border-surface-200-800">
				{m.form_fiber_b?.() || 'Faser B'} (OUT)
			</div>
		</div>

		<!-- Scrollable rows -->
		<div class="flex-1 overflow-y-auto min-h-0">
			{#each portRows as row (row.isMerged ? row.mergeGroupId : row.portNumber)}
				{#if row.isMerged}
					<!-- Merged Port Group Row -->
					<div
						class="grid {mergeSelectionMode
							? 'grid-cols-[40px_60px_1fr_1fr]'
							: 'grid-cols-[60px_1fr_1fr]'} border-b border-surface-200-800 last:border-b-0 bg-primary-500/5"
					>
						{#if mergeSelectionMode}
							<div class="px-2 py-2.5 flex items-center justify-center">
								<!-- Can't select merged rows for merge -->
							</div>
						{/if}
						<!-- Port Range -->
						<div
							class="px-3 py-2.5 text-center font-mono text-sm bg-primary-500/10 border-r border-surface-200-800 flex items-center justify-center gap-1"
						>
							<span class="font-semibold">{row.mergedPortRange}</span>
							<button
								type="button"
								class="p-1 rounded hover:bg-surface-300-700 transition-colors"
								onclick={() => onUnmergePorts(row.mergeGroupId)}
								title={m.action_unmerge?.() || 'Unmerge'}
							>
								<IconArrowsSplit size={14} />
							</button>
						</div>

						<!-- Fiber A Cell (IN) - Merged -->
						<FiberCell
							fiber={row.fiberACount > 0 ? row.fibersA[0] : null}
							hasPort={row.hasInPort}
							side="a"
							colorHex={getColorHex(row.fibersA[0]?.fiber_color)}
							isMerged={true}
							mergedCount={row.mergedPortCount}
							connectedCount={row.fiberACount}
							onDrop={(data) => onMergedPortDrop(row.mergeGroupId, 'a', data)}
							onClear={() => handleClearPort(row.portNumber, 'a')}
						/>

						<!-- Fiber B Cell (OUT) - Merged -->
						<FiberCell
							fiber={row.fiberBCount > 0 ? row.fibersB[0] : null}
							hasPort={row.hasOutPort}
							side="b"
							colorHex={getColorHex(row.fibersB[0]?.fiber_color)}
							isMerged={true}
							mergedCount={row.mergedPortCount}
							connectedCount={row.fiberBCount}
							onDrop={(data) => onMergedPortDrop(row.mergeGroupId, 'b', data)}
							onClear={() => handleClearPort(row.portNumber, 'b')}
						/>
					</div>
				{:else}
					<!-- Regular Port Row -->
					<div
						class="grid {mergeSelectionMode
							? 'grid-cols-[40px_60px_1fr_1fr]'
							: 'grid-cols-[60px_1fr_1fr]'} border-b border-surface-200-800 last:border-b-0 hover:bg-surface-100-900 transition-colors"
					>
						{#if mergeSelectionMode}
							<div class="px-2 py-2.5 flex items-center justify-center">
								<input
									type="checkbox"
									class="checkbox"
									checked={isPortSelected(row.portNumber, 'a') ||
										isPortSelected(row.portNumber, 'b')}
									onchange={() => {
										// Select both sides for simplicity
										onTogglePortSelection(row.portNumber, 'a');
									}}
								/>
							</div>
						{/if}
						<!-- Port Number -->
						<div
							class="px-3 py-2.5 text-center font-mono text-sm bg-surface-100-900 border-r border-surface-200-800 flex items-center justify-center"
						>
							{row.portNumber}
						</div>

						<!-- Fiber A Cell (IN) -->
						<FiberCell
							fiber={row.fiberA}
							hasPort={row.hasInPort}
							side="a"
							colorHex={getColorHex(row.fiberA?.fiber_color)}
							onDrop={(data) => handlePortDrop(row.portNumber, 'a', data)}
							onClear={() => handleClearPort(row.portNumber, 'a')}
						/>

						<!-- Fiber B Cell (OUT) -->
						<FiberCell
							fiber={row.fiberB}
							hasPort={row.hasOutPort}
							side="b"
							colorHex={getColorHex(row.fiberB?.fiber_color)}
							onDrop={(data) => handlePortDrop(row.portNumber, 'b', data)}
							onClear={() => handleClearPort(row.portNumber, 'b')}
						/>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Merge Action Bar (when ports selected) -->
		{#if mergeSelectionMode && selectedForMerge.size >= 2}
			<div class="p-2 border-t border-surface-200-800 bg-surface-200-800 flex justify-end gap-2">
				<button type="button" class="btn preset-filled-primary-500 text-sm" onclick={onMergePorts}>
					<IconArrowMerge size={16} />
					{m.action_merge?.() || 'Merge'}
					{selectedForMerge.size}
					{m.form_ports?.() || 'Ports'}
				</button>
			</div>
		{/if}
	{/if}
</div>
