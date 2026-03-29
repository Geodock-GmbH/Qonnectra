<script>
	import { cubicOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fly, slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		IconAlertTriangle,
		IconArrowsSplit,
		IconBolt,
		IconBoltOff,
		IconChevronDown,
		IconChevronRight,
		IconDownload,
		IconHome,
		IconMapPin
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import GenericCombobox from '$lib/components/GenericCombobox.svelte';

	import {
		downloadGeoJSON as downloadGeoJSONFile,
		hasGeometries,
		traceFrom
	} from '../traceUtils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Record<string, any>} result - The signal analysis result data
	 * @property {string} entryId - The entry UUID
	 * @property {boolean} [includeGeometry] - Whether geometry was included
	 * @property {string|null} [selectedItemId] - Currently selected item ID
	 * @property {(type: string, id: string) => void} [onItemSelect] - Selection callback
	 */

	/** @type {Props} */
	let {
		result,
		entryId,
		includeGeometry = false,
		selectedItemId = null,
		onItemSelect = () => {}
	} = $props();

	/**
	 * @param {string} type - The entity type (e.g. 'fiber', 'cable', 'node')
	 * @param {string} id - The entity UUID
	 * @returns {boolean} Whether the item matches the current selection
	 */
	function isSelected(type, id) {
		return selectedItemId === `${type}:${id}`;
	}

	/**
	 * @param {string} type - The entity type (e.g. 'fiber', 'cable', 'node')
	 * @param {string} id - The entity UUID
	 * @returns {void}
	 */
	function handleItemClick(type, id) {
		onItemSelect(type, id);
	}

	/**
	 * Updates the signal source node via URL search params and navigates.
	 * @param {string} nodeId - The source node UUID, or empty string to remove
	 * @returns {void}
	 */
	function changeSignalSource(nodeId) {
		const url = new URL(page.url);
		url.searchParams.set('mode', 'signal');
		if (nodeId) {
			url.searchParams.set('source', nodeId);
		} else {
			url.searchParams.delete('source');
		}
		goto(url.toString());
	}

	/**
	 * @returns {void}
	 */
	function handleDownloadGeoJSON() {
		if (!result) return;
		downloadGeoJSONFile(result, 'signal-analysis', entryId, page.data.srid);
	}

	const signalAnalysis = $derived(result?.signal_analysis);
	const affectedSummary = $derived(result?.affected_summary);
	const traceTree = $derived(result?.trace_tree);
	const statistics = $derived(result?.statistics);
	const availableSources = $derived(signalAnalysis?.available_sources || []);
	const sourceOptions = $derived(
		availableSources.map(
			(/** @type {{ id: string, name: string, direction: string, is_default: boolean }} */ s) => ({
				value: String(s.id),
				label: `${s.name} (${s.direction === 'start' ? m.signal_source_cable_start() : m.signal_source_cable_end()})${s.is_default ? ` (${m.common_default()})` : ''}`
			})
		)
	);
	const sourceNode = $derived(signalAnalysis?.source_node);
	const breakPoints = $derived(signalAnalysis?.break_points || []);
	const hasBreaks = $derived(breakPoints.length > 0);

	let expandedWaypoints = new SvelteSet();

	/**
	 * @param {string} fiberId
	 */
	function toggleWaypoint(fiberId) {
		if (expandedWaypoints.has(fiberId)) {
			expandedWaypoints.delete(fiberId);
		} else {
			expandedWaypoints.add(fiberId);
		}
	}
</script>

{#snippet statCard(
	/** @type {string} */ label,
	/** @type {number} */ value,
	/** @type {string} */ colorClass
)}
	<div
		class="rounded-xl border border-surface-200-800 bg-surface-50-950 p-4 text-center shadow-sm transition-all hover:shadow-md"
	>
		<div class="{colorClass} text-2xl font-bold">{value}</div>
		<div class="mt-1 text-xs font-medium text-surface-600-400">{label}</div>
	</div>
{/snippet}

{#snippet signalStatCard(
	/** @type {string} */ label,
	/** @type {number} */ litValue,
	/** @type {number} */ darkValue
)}
	<div
		class="rounded-xl border border-surface-200-800 bg-surface-50-950 p-4 text-center shadow-sm transition-all hover:shadow-md"
	>
		<div class="flex justify-center gap-4">
			<div class="text-center">
				<div class="text-xl font-bold text-success-500">{litValue}</div>
				<div class="mt-0.5 text-[10px] text-success-500">{m.signal_lit()}</div>
			</div>
			<div class="w-px bg-surface-200-800"></div>
			<div class="text-center">
				<div class="text-xl font-bold text-surface-500">{darkValue}</div>
				<div class="mt-0.5 text-[10px] text-surface-500">{m.signal_dark()}</div>
			</div>
		</div>
		<div class="mt-2 text-xs font-medium text-surface-600-400">{label}</div>
	</div>
{/snippet}

{#snippet breakPointCard(/** @type {Record<string, any>} */ bp)}
	<div
		class="rounded-lg border border-error-500/30 bg-error-500/10 p-3 transition-colors hover:bg-error-500/15"
	>
		<div class="flex items-center gap-2">
			<IconAlertTriangle size={18} class="text-error-500" />
			<span class="font-semibold text-error-500">{m.signal_break_point()}</span>
		</div>
		<div class="mt-2 flex flex-wrap gap-2 text-xs">
			<button
				type="button"
				class="rounded bg-primary-500/15 px-2 py-0.5 font-mono text-primary-500 hover:bg-primary-500/25"
				onclick={() => handleItemClick('fiber', bp.fiber_id)}
			>
				F{bp.fiber_number_absolute}
			</button>
			<span class="text-surface-600-400">in</span>
			<button
				type="button"
				class="rounded bg-success-500/15 px-2 py-0.5 font-mono text-success-500 hover:bg-success-500/25"
				onclick={() => handleItemClick('cable', bp.cable_id)}
			>
				{bp.cable_name}
			</button>
		</div>
		{#if bp.at_node}
			<div class="mt-2 text-xs text-surface-600-400">
				{m.signal_break_at()}:
				<button
					type="button"
					class="ml-1 rounded bg-warning-500/15 px-1.5 py-0.5 font-mono text-warning-500 hover:bg-warning-500/25"
					onclick={() => handleItemClick('node', bp.at_node.id)}
				>
					{bp.at_node.name}
				</button>
			</div>
		{/if}
		{#if bp.status}
			<div class="mt-2">
				<span class="rounded bg-error-500 px-2 py-0.5 text-xs font-medium text-white">
					{bp.status}
				</span>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet signalTraceNode(
	/** @type {Record<string, any>} */ node,
	/** @type {number} */ depth,
	/** @type {boolean} */ isLastChild
)}
	{@const signalState = node.signal_state || 'lit'}
	{@const isLit = signalState === 'lit'}
	{@const isDark = signalState === 'dark'}
	{@const isBreak = signalState === 'break_point'}
	{@const hasDetails =
		node.splice ||
		(node.cable_endpoints && (node.cable_endpoints.start_node || node.cable_endpoints.end_node)) ||
		node.node?.address ||
		(node.residential_units && node.residential_units.length > 0)}
	{@const isExpanded = expandedWaypoints.has(node.fiber.id)}
	{@const hasChildren = node.children && node.children.length > 0}
	{@const STEP = 28}
	{@const INDENT = 20}
	{@const lineX = depth * STEP + INDENT}
	{@const parentLineX = (depth - 1) * STEP + INDENT}
	{@const circleSize = 12}
	{@const circleTop = 10}

	<div
		class="relative {isDark ? 'opacity-50' : ''}"
		style="padding-left: {depth * STEP + INDENT + circleSize + 8}px"
	>
		<!-- Vertical line from parent -->
		{#if depth > 0}
			<div
				class="absolute top-0 w-px bg-surface-300-700"
				style="left: {parentLineX + circleSize / 2}px"
				style:height={isLastChild ? `${circleTop + circleSize / 2}px` : '100%'}
			></div>
		{/if}

		<!-- Vertical line down to children -->
		{#if hasChildren}
			<div
				class="absolute bottom-0 w-px bg-surface-300-700"
				style="left: {lineX + circleSize / 2}px; top: {circleTop + circleSize}px"
			></div>
		{/if}

		<!-- Horizontal connector from parent to circle -->
		{#if depth > 0}
			<div
				class="absolute h-px bg-surface-300-700"
				style="left: {parentLineX + circleSize / 2}px; top: {circleTop +
					circleSize / 2}px; width: {STEP - circleSize / 2}px"
			></div>
		{/if}

		<!-- Circle marker (colored by signal state) -->
		<div
			class="absolute rounded-full border-2 {isBreak
				? 'border-error-500 bg-error-500'
				: isDark
					? 'border-surface-500 bg-surface-500'
					: isSelected('fiber', node.fiber.id)
						? 'border-success-500 bg-success-500'
						: 'border-success-500 bg-surface-50-950'}"
			style="left: {lineX}px; top: {circleTop}px; width: {circleSize}px; height: {circleSize}px"
		></div>

		<!-- Waypoint content -->
		<div class="pb-4">
			<!-- Line 1: Signal badge + Fiber + Cable + Node -->
			<div class="flex flex-wrap items-center gap-1.5 py-1 text-xs">
				{#if isBreak}
					<span
						class="flex items-center gap-1 rounded bg-error-500 px-1.5 py-0.5 text-xs font-medium text-white"
					>
						<IconAlertTriangle size={10} />
						{m.signal_break_point()}
					</span>
				{:else if isDark}
					<span
						class="flex items-center gap-1 rounded bg-surface-500 px-1.5 py-0.5 text-xs font-medium text-white"
					>
						<IconBoltOff size={10} />
						{m.signal_no_signal()}
					</span>
				{:else}
					<span
						class="flex items-center gap-1 rounded bg-success-500 px-1.5 py-0.5 text-xs font-medium text-white"
					>
						<IconBolt size={10} />
						{m.signal_lit()}
					</span>
				{/if}
				<button
					type="button"
					class="rounded px-2 py-0.5 font-mono font-medium transition-colors {isSelected(
						'fiber',
						node.fiber.id
					)
						? 'bg-primary-500 text-white'
						: 'bg-primary-500/15 text-primary-500 hover:bg-primary-500/25'}"
					onclick={() => handleItemClick('fiber', node.fiber.id)}
				>
					F{node.fiber.fiber_number_absolute}
				</button>
				<span class="text-surface-500-400">in</span>
				<button
					type="button"
					class="rounded px-2 py-0.5 font-mono font-medium transition-colors {isSelected(
						'cable',
						node.fiber.cable_id
					)
						? 'bg-success-500 text-white'
						: 'bg-success-500/15 text-success-500 hover:bg-success-500/25'}"
					onclick={() => handleItemClick('cable', node.fiber.cable_id)}
				>
					{node.fiber.cable_name}
				</button>
				{#if node.fiber.cable_type}
					<span class="rounded bg-surface-100-900 px-1.5 py-0.5 text-surface-600-400">
						{node.fiber.cable_type}
					</span>
				{/if}
				{#if node.node}
					<span class="text-surface-400-500">→</span>
					<button
						type="button"
						class="rounded px-2 py-0.5 font-mono font-medium transition-colors {isSelected(
							'node',
							node.node.id
						)
							? 'bg-warning-500 text-white'
							: 'bg-warning-500/15 text-warning-500 hover:bg-warning-500/25'}"
						onclick={() => handleItemClick('node', node.node.id)}
					>
						{node.node.name}
					</button>
				{/if}
			</div>

			<!-- Line 2: Cable path anchor + colors + expand toggle -->
			<div class="flex items-center gap-2 pl-0.5">
				{#if node.cable_endpoints}
					<span class="text-xs text-surface-500-400">
						{node.cable_endpoints.start_node?.name || '?'}
						<span class="mx-0.5">↔</span>
						{node.cable_endpoints.end_node?.name || '?'}
					</span>
				{/if}
				{#if node.fiber.fiber_color}
					<span
						class="inline-block h-2.5 w-2.5 rounded-full border border-white/20"
						style="background: {node.fiber.fiber_color_hex || '#64748b'}"
						title={node.fiber.fiber_color}
					></span>
				{/if}
				{#if node.fiber.bundle_color}
					<span
						class="inline-block h-2.5 w-2.5 rounded-full border border-white/20 opacity-70"
						style="background: {node.fiber.bundle_color_hex || '#64748b'}"
						title="B: {node.fiber.bundle_color}"
					></span>
				{/if}
				{#if hasDetails}
					<button
						type="button"
						class="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-surface-500-400 transition-colors hover:bg-surface-100-900 hover:text-surface-700-300"
						onclick={() => toggleWaypoint(node.fiber.id)}
					>
						<span>{m.trace_details ? m.trace_details() : 'Details'}</span>
						<IconChevronDown
							size={14}
							class="transition-transform {isExpanded ? 'rotate-180' : ''}"
						/>
					</button>
				{/if}
			</div>

			<!-- Expandable details drawer -->
			{#if hasDetails && isExpanded}
				<div class="mt-2 space-y-2 pl-0.5" transition:slide={{ duration: 150 }}>
					{@render fiberDetails(node.fiber)}

					{#if node.splice}
						{@render spliceDetails(node.splice)}
					{/if}

					{#if node.cable_endpoints && (node.cable_endpoints.start_node || node.cable_endpoints.end_node)}
						{@render cableEndpointsDetails(node.cable_endpoints, node.node?.id)}
					{/if}

					{#if node.node?.address}
						{@render addressDetails(node.node.address, isDark)}
					{/if}

					{#if node.residential_units && node.residential_units.length > 0}
						{#each node.residential_units as ru (ru.id)}
							{@render residentialUnitDetails(ru, isDark)}
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Children -->
		{#if hasChildren}
			{#each node.children as child, i (child.fiber.id)}
				{@render signalTraceNode(child, depth + 1, i === node.children.length - 1)}
			{/each}
		{/if}
	</div>
{/snippet}

{#snippet fiberDetails(/** @type {Record<string, any>} */ fiber)}
	<div class="flex flex-wrap items-center gap-2 text-xs">
		{#if fiber.bundle_number !== null && fiber.bundle_number !== undefined}
			<span class="text-surface-900-100"
				>{m.form_bundle()}: <code class="text-surface-700-300">{fiber.bundle_number}</code></span
			>
		{/if}
		{#if fiber.fiber_number_in_bundle}
			<span class="text-surface-900-100"
				>{m.trace_in_bundle()}:
				<code class="text-surface-700-300">{fiber.fiber_number_in_bundle}</code></span
			>
		{/if}
		{#if fiber.fiber_color}
			<span
				class="rounded px-1.5 py-0.5 font-medium text-white"
				style="background: {fiber.fiber_color_hex || '#64748b'}"
			>
				{fiber.fiber_color}
			</span>
		{/if}
		{#if fiber.bundle_color}
			<span
				class="rounded px-1.5 py-0.5 font-medium text-white opacity-80"
				style="background: {fiber.bundle_color_hex || '#64748b'}"
			>
				B: {fiber.bundle_color}
			</span>
		{/if}
		{#if fiber.layer}
			<span class="text-surface-900-100"
				>{m.form_layer()}: <code class="text-surface-700-300">{fiber.layer}</code></span
			>
		{/if}
		{#if fiber.status}
			<span class="rounded bg-surface-100-900 px-1.5 py-0.5 text-surface-900-100"
				>{fiber.status}</span
			>
		{/if}
	</div>
{/snippet}

{#snippet spliceDetails(/** @type {Record<string, any>} */ splice)}
	<div class="rounded-lg border border-secondary-500/30 bg-secondary-500/5 px-3 py-1.5 text-xs">
		<div class="mb-1 flex items-center gap-2 text-secondary-500">
			<IconArrowsSplit size={14} />
			<span class="font-semibold">{m.trace_splice()}</span>
			<code class="text-surface-600-400">{m.form_port()} {splice.port_number}</code>
		</div>
		{#if splice.component}
			<div class="flex flex-wrap gap-1.5">
				{#if splice.component.type}
					<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
						{splice.component.type}
					</span>
				{/if}
				{#if splice.component.slot_start !== null && splice.component.slot_end !== null}
					<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
						{m.form_slot({ count: 2 })}
						{splice.component.slot_start}-{splice.component.slot_end}
					</span>
				{/if}
				{#if splice.component.slot_side}
					<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
						{m.form_side()}: {splice.component.slot_side}
					</span>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet cableEndpointsDetails(
	/** @type {Record<string, any>} */ endpoints,
	/** @type {string|undefined} */ currentNodeId
)}
	<div class="rounded-lg border border-primary-500/30 bg-primary-500/5 px-3 py-1.5 text-xs">
		<div class="mb-1 font-semibold text-primary-500">
			{m.trace_cable_endpoints()}
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if endpoints.start_node}
				<div class="flex items-center gap-1">
					<span class="text-xs uppercase text-surface-600-400">{m.signal_source_cable_start()}</span
					>
					<button
						type="button"
						class="rounded px-1.5 py-0.5 font-mono text-xs {currentNodeId ===
						endpoints.start_node.id
							? 'bg-primary-500/20 text-primary-500'
							: 'bg-surface-200-800 text-surface-900-100'} hover:bg-surface-300-700"
						onclick={() => traceFrom('node', endpoints.start_node.id)}
					>
						{endpoints.start_node.name}
					</button>
					{#if endpoints.start_node.type}
						<span class="text-xs text-surface-600-400">{endpoints.start_node.type}</span>
					{/if}
				</div>
			{/if}

			<span class="text-surface-500-400">↔</span>

			{#if endpoints.end_node}
				<div class="flex items-center gap-1">
					<span class="text-xs uppercase text-surface-600-400">{m.signal_source_cable_end()}</span>
					<button
						type="button"
						class="rounded px-1.5 py-0.5 font-mono text-xs {currentNodeId === endpoints.end_node.id
							? 'bg-primary-500/20 text-primary-500'
							: 'bg-surface-200-800 text-surface-900-100'} hover:bg-surface-300-700"
						onclick={() => traceFrom('node', endpoints.end_node.id)}
					>
						{endpoints.end_node.name}
					</button>
					{#if endpoints.end_node.type}
						<span class="text-xs text-surface-600-400">{endpoints.end_node.type}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet addressDetails(
	/** @type {Record<string, any>} */ address,
	/** @type {boolean} */ isDark = false
)}
	<div
		class="rounded-lg border {isDark
			? 'border-surface-400/30 bg-surface-200-800'
			: 'border-error-500/30 bg-error-500/5'} px-3 py-1.5 text-xs"
	>
		<div class="mb-1 flex items-center gap-2 {isDark ? 'text-surface-500' : 'text-error-500'}">
			<IconMapPin size={14} />
			<span class="font-semibold">{m.form_address({ count: 1 })}</span>
			{#if isDark}
				<span class="rounded bg-surface-500 px-1.5 py-0.5 text-[10px] text-white">
					{m.signal_no_signal()}
				</span>
			{/if}
		</div>
		<div class="text-surface-900-100">
			{address.street}
			{address.housenumber}{address.suffix || ''}, {address.zip_code}
			{address.city}
		</div>
	</div>
{/snippet}

{#snippet residentialUnitDetails(
	/** @type {Record<string, any>} */ ru,
	/** @type {boolean} */ isDark = false
)}
	<div
		class="rounded-lg border {isDark
			? 'border-surface-400/30 bg-surface-200-800'
			: 'border-tertiary-500/30 bg-tertiary-500/5'} px-3 py-1.5 text-xs"
	>
		<div class="mb-1 flex items-center gap-2 {isDark ? 'text-surface-500' : 'text-tertiary-500'}">
			<IconHome size={14} />
			<span class="font-semibold">{m.section_residential_units({ count: 1 })}</span>
			{#if isDark}
				<span class="rounded bg-surface-500 px-1.5 py-0.5 text-[10px] text-white">
					{m.signal_no_signal()}
				</span>
			{/if}
		</div>
		<div class="flex flex-wrap gap-1.5">
			{#if ru.id_residential_unit}
				<span class="text-surface-900-100">ID: {ru.id_residential_unit}</span>
			{/if}
			{#if ru.floor !== null && ru.floor !== undefined}
				<span class="text-surface-900-100">{m.form_floor()}: {ru.floor}</span>
			{/if}
			{#if ru.side}
				<span class="text-surface-900-100">{m.form_side()}: {ru.side}</span>
			{/if}
			{#if ru.resident_name}
				<span class="text-surface-900-100">{ru.resident_name}</span>
			{/if}
		</div>
	</div>
{/snippet}

{#if result}
	<div class="space-y-8" transition:fly={{ y: 30, duration: 400, easing: cubicOut }}>
		<!-- Signal Source Selector -->
		<section>
			<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-surface-900-100">
				<span class="h-5 w-1 rounded bg-warning-500"></span>
				{m.signal_source()}
			</h2>
			<div class="flex items-center gap-4">
				<div class="w-full max-w-2xl">
					<GenericCombobox
						data={sourceOptions}
						value={sourceNode?.id ? [String(sourceNode.id)] : []}
						onValueChange={(/** @type {{ value: string[] }} */ e) => {
							changeSignalSource(e.value[0] || '');
						}}
					/>
				</div>
				{#if sourceNode}
					<span class="text-sm text-surface-600-400">
						{sourceNode.type || ''}
					</span>
				{/if}
			</div>
		</section>

		<!-- Break Points Summary -->
		{#if hasBreaks}
			<section>
				<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-error-500">
					<span class="h-5 w-1 rounded bg-error-500"></span>
					{m.signal_break_point()} ({signalAnalysis.total_breaks})
				</h2>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each breakPoints as bp (bp.fiber_id)}
						{@render breakPointCard(bp)}
					{/each}
				</div>
			</section>
		{:else}
			<div
				class="flex items-center gap-3 rounded-lg border border-success-500/30 bg-success-500/10 px-4 py-3"
			>
				<IconBolt size={20} class="text-success-500" />
				<span class="text-success-600">{m.signal_no_breaks()}</span>
			</div>
		{/if}

		<!-- Impact Summary Statistics -->
		{#if affectedSummary}
			<section>
				<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-surface-900-100">
					<span class="h-5 w-1 rounded bg-tertiary-500"></span>
					{m.signal_affected_summary()}
				</h2>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{@render signalStatCard(
						m.form_fibers(),
						affectedSummary.lit_fibers,
						affectedSummary.dark_fibers
					)}
					{@render signalStatCard(
						m.nav_node(),
						affectedSummary.lit_nodes,
						affectedSummary.dark_nodes
					)}
					{@render statCard(
						m.signal_affected_addresses(),
						affectedSummary.affected_addresses,
						'text-error-500'
					)}
					{@render statCard(
						m.signal_affected_rus(),
						affectedSummary.affected_residential_units,
						'text-primary-400'
					)}
				</div>
			</section>
		{/if}

		<!-- Download Button -->
		{#if includeGeometry && hasGeometries(result)}
			<div class="flex justify-center">
				<button
					type="button"
					onclick={handleDownloadGeoJSON}
					class="flex items-center gap-3 rounded-lg border border-success-500 px-5 py-2.5 font-medium text-success-500 transition-colors hover:bg-success-500/10"
				>
					<IconDownload size={20} />
					<span>{m.trace_download_geojson()}</span>
				</button>
			</div>
		{/if}

		<!-- Signal Flow Tree -->
		{#if traceTree}
			<section>
				<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-surface-900-100">
					<span class="h-5 w-1 rounded bg-primary-500"></span>
					{m.signal_analysis()}
				</h2>
				{@render signalTraceNode(traceTree, 0, true)}
			</section>
		{/if}
	</div>
{/if}
