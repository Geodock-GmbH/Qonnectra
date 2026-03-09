<script>
	import {
		IconArrowsSplit,
		IconHome,
		IconLoader2,
		IconRoute,
		IconTrash
	} from '@tabler/icons-svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	import { m } from '$lib/paraglide/messages';

	import { tooltip } from '$lib/utils/tooltip.js';

	let {
		fiber = null,
		residentialUnit = null,
		hasPort = true,
		side = 'a',
		colorHex = '#999999',
		portNumber = 0,
		cableUuid = null,
		readonly = false,
		onDrop = () => {},
		onClear = () => {},
		onUnmerge = () => {},
		// Merge props
		isMerged = false,
		mergedCount = 0,
		connectedCount = 0,
		// Spanning props for merged cells
		spanRows = 1,
		portRange = ''
	} = $props();

	/**
	 * Get display name for a residential unit
	 */
	function getResidentialUnitDisplayName(ru) {
		if (!ru) return '';
		let main = ru.id_residential_unit || 'Unit';
		if (ru.external_id_1) {
			main += ` (${ru.external_id_1})`;
		} else if (ru.external_id_2) {
			main += ` (${ru.external_id_2})`;
		} else if (ru.floor || ru.side) {
			const parts = [];
			if (ru.floor) parts.push(`${ru.floor}. OG`);
			if (ru.side) parts.push(ru.side);
			if (parts.length) main += ` (${parts.join(' ')})`;
		}
		return main;
	}

	// Whether anything is connected (fiber or residential unit)
	const hasConnection = $derived(fiber || residentialUnit);

	let isDragOver = $state(false);
	let isDragging = $state(false);

	// Trace state
	let traceLoading = $state(false);
	let traceResult = $state(null);
	let traceError = $state(null);

	/**
	 * Fetch trace summary for this fiber
	 */
	async function handleTrace(e) {
		e.stopPropagation();
		if (traceResult) {
			traceResult = null;
			return;
		}
		if (!fiber?.uuid) return;

		traceLoading = true;
		traceError = null;
		try {
			const response = await fetch(`${PUBLIC_API_URL}fiber-trace/summary/?fiber_id=${fiber.uuid}`, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Trace failed');
			traceResult = await response.json();
		} catch (err) {
			traceError = err.message;
		} finally {
			traceLoading = false;
		}
	}

	// Color accent based on side
	const accentClasses = $derived(
		side === 'a'
			? {
					bg: 'bg-secondary-50-950',
					bgHover: 'bg-secondary-200-800',
					outline: 'outline-blue-400',
					clearHover: 'hover:bg-secondary-50-950'
				}
			: {
					bg: 'bg-secondary-50-950',
					bgHover: 'bg-secondary-200-800',
					outline: 'outline-amber-400',
					clearHover: 'hover:bg-secondary-50-950'
				}
	);

	function handleDragStart(e) {
		if (readonly || !fiber || !hasPort || isMerged) {
			e.preventDefault();
			return;
		}

		isDragging = true;

		// Create drag data with fiber info and source location
		const dragData = {
			type: 'fiber',
			uuid: fiber.uuid,
			cable_uuid: cableUuid || fiber.cable_uuid,
			cable_name: fiber.cable_name,
			fiber_number: fiber.fiber_number,
			fiber_color: fiber.fiber_color,
			bundle_number: fiber.bundle_number,
			// Source info for move operation
			sourcePortNumber: portNumber,
			sourceSide: side,
			isMove: true
		};

		e.dataTransfer.setData('application/json', JSON.stringify(dragData));
		e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragEnd() {
		isDragging = false;
	}

	function handleDragOver(e) {
		if (readonly || !hasPort) return;
		e.preventDefault();
		e.stopPropagation();
		// Accept both copy (external drops) and move (internal reorder)
		if (e.dataTransfer.effectAllowed === 'move') {
			e.dataTransfer.dropEffect = 'move';
		} else {
			e.dataTransfer.dropEffect = 'copy';
		}
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e) {
		if (readonly || !hasPort) return;
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;

		const jsonData = e.dataTransfer.getData('application/json');
		if (jsonData) {
			try {
				const data = JSON.parse(jsonData);
				onDrop(data);
			} catch (err) {
				console.error('Failed to parse drop data:', err);
			}
		}
	}
</script>

<div
	class="fiber-cell px-3 py-2 min-h-[44px] transition-all duration-150 border-l border-b border-surface-200-800 {!hasPort
		? 'bg-surface-200-800 cursor-not-allowed'
		: ''} {isDragOver && hasPort
		? `${accentClasses.bgHover} outline outline-dashed ${accentClasses.outline}`
		: ''} {hasConnection && spanRows <= 1 ? accentClasses.bg : ''} {spanRows > 1
		? 'bg-surface-50 dark:bg-surface-900  border-primary-500 '
		: ''} flex items-center"
	style={spanRows > 1 ? `grid-row: span ${spanRows}` : ''}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role={hasPort ? 'button' : 'presentation'}
>
	{#if fiber}
		<!-- Connected Fiber Display - draggable for move operations, also accepts drops for override -->
		<div
			class="flex items-center gap-2 group w-full {!isMerged && !readonly
				? 'cursor-grab active:cursor-grabbing'
				: ''} {isDragging ? 'opacity-50' : ''}"
			draggable={!isMerged && !readonly}
			ondragstart={handleDragStart}
			ondragend={handleDragEnd}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			role="button"
			tabindex="0"
		>
			<span
				class="w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0"
				style="background-color: {colorHex}"
			></span>
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-1.5 text-sm font-medium">
					<span class="font-mono">{fiber.fiber_number}</span>
					<span class="text-surface-400">|</span>
					<span class="text-surface-500">B{fiber.bundle_number}</span>
				</div>
				<div class="text-xs text-surface-400 truncate">
					{fiber.cable_name}
				</div>
				{#if traceResult}
					<div class="text-xs text-surface-500 mt-1 flex items-center gap-1">
						<span class="text-surface-400">↳</span>
						{#if traceResult.start_node?.name}
							<span class="font-medium">{traceResult.start_node.name}</span>
							<span class="text-surface-400">→</span>
						{/if}
						{#if traceResult.end_node?.name}
							<span class="font-medium">{traceResult.end_node.name}</span>
						{/if}
					</div>
					<div class="text-xs text-surface-400">
						{traceResult.statistics.total_splices}
						{m.trace_splices({ count: traceResult.statistics.total_splices }) || 'splices'} ·
						{traceResult.statistics.total_addresses}
						{m.trace_addresses({ count: traceResult.statistics.total_addresses }) || 'addresses'}
						{#if traceResult.statistics.total_residential_units > 0}
							· {traceResult.statistics.total_residential_units}
							{m.trace_residential_units({
								count: traceResult.statistics.total_residential_units
							}) || 'RU'}
						{/if}
					</div>
				{:else if traceError}
					<div class="text-xs text-error-500 mt-1">
						{m.trace_error?.() || 'Trace failed'}
					</div>
				{/if}
			</div>
			{#if !readonly}
				<div class="flex items-center gap-1 ml-auto">
					{#if spanRows > 1}
						<button
							type="button"
							class="p-1 rounded hover:bg-surface-300-700 transition-colors opacity-0 group-hover:opacity-100"
							onclick={(e) => {
								e.stopPropagation();
								onUnmerge();
							}}
							aria-label={m.action_unmerge?.() || 'Unmerge'}
							{@attach tooltip(m.action_unmerge?.() || 'Unmerge')}
						>
							<IconArrowsSplit size={16} />
						</button>
					{/if}
					<button
						type="button"
						class="p-1 rounded hover:bg-surface-300-700 transition-colors opacity-0 group-hover:opacity-100 {traceResult
							? 'opacity-100 text-primary-500'
							: ''}"
						onclick={handleTrace}
						disabled={traceLoading}
						aria-label={m.action_trace?.() || 'Trace'}
						{@attach tooltip(m.action_trace?.() || 'Trace')}
					>
						{#if traceLoading}
							<IconLoader2 size={16} class="animate-spin" />
						{:else}
							<IconRoute size={16} />
						{/if}
					</button>
					<button
						type="button"
						class="btn-sm p-1 rounded-md opacity-0 group-hover:opacity-100 bg-error-500 hover:bg-error-600 text-white transition-all shrink-0"
						onclick={(e) => {
							e.stopPropagation();
							onClear();
						}}
						aria-label={m.common_clear?.() || 'Clear'}
					>
						<IconTrash size={20} />
					</button>
				</div>
			{/if}
		</div>
	{:else if residentialUnit}
		<!-- Connected Residential Unit Display -->
		<div class="flex items-center gap-2 group w-full">
			<IconHome size={16} class="shrink-0 text-primary-500" />
			<div class="flex-1 min-w-0">
				<div class="text-sm font-medium truncate">
					{getResidentialUnitDisplayName(residentialUnit)}
				</div>
				{#if residentialUnit.resident_name}
					<div class="text-xs text-surface-400 truncate">
						{residentialUnit.resident_name}
					</div>
				{/if}
			</div>
			{#if !readonly}
				<div class="flex items-center gap-1 ml-auto">
					<button
						type="button"
						class="btn-sm p-1 rounded-md opacity-0 group-hover:opacity-100 bg-error-500 hover:bg-error-600 text-white transition-all shrink-0"
						onclick={(e) => {
							e.stopPropagation();
							onClear();
						}}
						aria-label={m.common_clear?.() || 'Clear'}
					>
						<IconTrash size={20} />
					</button>
				</div>
			{/if}
		</div>
	{:else if hasPort}
		<!-- Empty Drop Zone -->
		<div class="flex flex-col items-center justify-center w-full h-full text-surface-400 group">
			{#if spanRows > 1}
				<!-- Merged empty state with port range -->
				<div
					class="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 mb-1"
				>
					<span class="font-mono">{portRange}</span>
					{#if !readonly}
						<button
							type="button"
							class="p-1 rounded hover:bg-surface-300-700 transition-colors opacity-0 group-hover:opacity-100"
							onclick={(e) => {
								e.stopPropagation();
								onUnmerge();
							}}
							aria-label={m.action_unmerge?.() || 'Unmerge'}
							{@attach tooltip(m.action_unmerge?.() || 'Unmerge')}
						>
							<IconArrowsSplit size={14} />
						</button>
					{/if}
				</div>
			{/if}
			{#if !readonly}
				<div class="flex items-center gap-2 text-xs italic">
					<span>{m.message_drop_fiber_here()}</span>
				</div>
			{/if}
		</div>
	{:else}
		<!-- No Port -->
		<div class="flex items-center justify-center h-full">
			<span class="text-surface-300 text-sm">-</span>
		</div>
	{/if}
</div>
