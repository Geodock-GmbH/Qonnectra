<script>
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import {
		IconArrowsSplit,
		IconChevronDown,
		IconChevronRight,
		IconHome,
		IconMapPin,
		IconSearch
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { traceFrom } from '../traceUtils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Array<Record<string, any>>} traceTrees - Array of fiber path tree objects
	 */

	/** @type {Props} */
	let { traceTrees } = $props();

	let searchQuery = $state('');
	let expandedRows = new SvelteSet();
	/** @type {HTMLDivElement | null} */
	let containerEl = $state(null);
	let scrollTop = $state(0);

	const ROW_HEIGHT = 52;
	const BUFFER_SIZE = 10;
	const CONTAINER_HEIGHT = 600;

	/**
	 * Extract destinations from a tree (recursive)
	 * @param {Record<string, any>} tree
	 * @returns {string[]}
	 */
	function collectDestinations(tree) {
		const destinations = new Set();

		/** @param {Record<string, any>} node */
		function traverse(node) {
			if (node.node?.name) {
				destinations.add(node.node.name);
			}
			if (node.cable_endpoints?.end_node?.name) {
				destinations.add(node.cable_endpoints.end_node.name);
			}
			if (node.children) {
				for (const child of node.children) {
					traverse(child);
				}
			}
		}

		traverse(tree);
		return Array.from(destinations);
	}

	/**
	 * Count residential units in a tree (recursive)
	 * @param {Record<string, any>} tree
	 * @returns {number}
	 */
	function countResidentialUnits(tree) {
		let count = 0;

		/** @param {Record<string, any>} node */
		function traverse(node) {
			if (node.residential_units?.length) {
				count += node.residential_units.length;
			}
			if (node.children) {
				for (const child of node.children) {
					traverse(child);
				}
			}
		}

		traverse(tree);
		return count;
	}

	/**
	 * Extract row data from a trace tree
	 * @param {Record<string, any>} tree
	 * @param {number} index
	 * @returns {Record<string, any>} Flattened row data including fiber info, colors, destinations, and residential unit count
	 */
	function extractRowData(tree, index) {
		const fiber = tree.fiber;
		const destinations = collectDestinations(tree);
		return {
			index,
			fiberNumber: fiber?.fiber_number_absolute ?? 0,
			fiberId: fiber?.id,
			cableId: fiber?.cable_id,
			cableName: fiber?.cable_name ?? '',
			cableType: fiber?.cable_type,
			bundleColor: fiber?.bundle_color,
			bundleColorHex: fiber?.bundle_color_hex,
			fiberColor: fiber?.fiber_color,
			fiberColorHex: fiber?.fiber_color_hex,
			destinations,
			residentialUnitCount: countResidentialUnits(tree),
			tree
		};
	}

	let rowsData = $derived(traceTrees.map((tree, i) => extractRowData(tree, i)));

	let filteredRows = $derived.by(() => {
		if (!searchQuery.trim()) return rowsData;

		const query = searchQuery.toLowerCase().trim();
		return rowsData.filter((row) => {
			const fiberMatch =
				`f${row.fiberNumber}`.includes(query) || `${row.fiberNumber}`.includes(query);
			const cableMatch = row.cableName.toLowerCase().includes(query);
			const destinationMatch = row.destinations.some((/** @type {string} */ d) =>
				d.toLowerCase().includes(query)
			);
			return fiberMatch || cableMatch || destinationMatch;
		});
	});

	let visibleRange = $derived.by(() => {
		const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE);
		const visibleCount = Math.ceil(CONTAINER_HEIGHT / ROW_HEIGHT);
		const end = Math.min(filteredRows.length, start + visibleCount + BUFFER_SIZE * 2);
		return { start, end };
	});

	let isVirtual = $derived(expandedRows.size === 0);

	let visibleRows = $derived(
		isVirtual ? filteredRows.slice(visibleRange.start, visibleRange.end) : filteredRows
	);

	let totalHeight = $derived(filteredRows.length * ROW_HEIGHT);

	let offsetY = $derived(visibleRange.start * ROW_HEIGHT);

	/**
	 * Toggle the expanded/collapsed state of a table row
	 * @param {number} index - Row index to toggle
	 * @returns {void}
	 */
	function toggleRow(index) {
		if (expandedRows.has(index)) {
			expandedRows.delete(index);
		} else {
			expandedRows.add(index);
		}
	}

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

	/**
	 * Update scroll position for virtual scrolling calculations
	 * @param {Event & { currentTarget: HTMLElement }} e - Scroll event from the container
	 * @returns {void}
	 */
	function handleScroll(e) {
		scrollTop = e.currentTarget.scrollTop;
	}
</script>

<div class="space-y-4">
	<div class="relative">
		<IconSearch size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500-400" />
		<input
			type="text"
			bind:value={searchQuery}
			placeholder={m.trace_filter_placeholder()}
			class="w-full rounded-lg border border-surface-200-800 bg-surface-100-900 py-2.5 pl-10 pr-4 text-sm text-surface-900-100 placeholder:text-surface-500-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
		/>
		{#if searchQuery}
			<span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-500-400">
				{filteredRows.length} / {rowsData.length}
			</span>
		{/if}
	</div>

	<!-- Desktop table header -->
	<div
		class="hidden grid-cols-[60px_1fr_120px_1fr_80px_40px] gap-2 rounded-t-lg border border-b-0 border-surface-200-800 bg-surface-100-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-600-400 sm:grid"
	>
		<span>{m.form_fiber()}</span>
		<span>{m.form_cables()}</span>
		<span>{m.form_colors()}</span>
		<span>{m.trace_end()}</span>
		<span>{m.form_residential_units()}</span>
		<span></span>
	</div>

	<div
		bind:this={containerEl}
		onscroll={isVirtual ? handleScroll : undefined}
		class="relative overflow-auto border border-surface-200-800 sm:rounded-b-lg"
		style="max-height: {CONTAINER_HEIGHT}px"
	>
		{#if isVirtual}
			<div style="height: {totalHeight}px; position: relative;">
				<div style="transform: translateY({offsetY}px);">
					{#each visibleRows as row (row.fiberId ?? row.index)}
						{@render tableRow(row)}
					{/each}
				</div>
			</div>
		{:else}
			{#each visibleRows as row (row.fiberId ?? row.index)}
				{@render tableRow(row)}
			{/each}
		{/if}
	</div>

	<div class="text-center text-xs text-surface-500-400">
		{filteredRows.length}
		{filteredRows.length === 1 ? m.form_fiber() : m.form_fibers()}
	</div>
</div>

{#snippet tableRow(/** @type {Record<string, any>} */ row)}
	<!-- Mobile card view -->
	<div class="border-b border-surface-200-800 p-3 sm:hidden">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="rounded bg-primary-500/15 px-2 py-1 font-mono text-sm font-medium text-primary-500 hover:bg-primary-500/25"
					onclick={() => traceFrom('fiber', row.fiberId)}
				>
					F{row.fiberNumber}
				</button>
				<button
					type="button"
					class="truncate rounded bg-success-500/15 px-2 py-1 font-mono text-sm font-medium text-success-500 hover:bg-success-500/25"
					onclick={() => traceFrom('cable', row.cableId)}
				>
					{row.cableName}
				</button>
			</div>
			<button
				type="button"
				class="flex items-center justify-center rounded p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-900-100"
				onclick={() => toggleRow(row.index)}
			>
				{#if expandedRows.has(row.index)}
					<IconChevronDown size={18} />
				{:else}
					<IconChevronRight size={18} />
				{/if}
			</button>
		</div>
		<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
			{#if row.fiberColor}
				<span
					class="rounded px-2 py-0.5 text-[10px] font-medium text-white"
					style="background: {row.fiberColorHex || '#64748b'}"
				>
					{row.fiberColor}
				</span>
			{/if}
			{#if row.bundleColor}
				<span
					class="rounded px-2 py-0.5 text-[10px] font-medium text-white opacity-80"
					style="background: {row.bundleColorHex || '#64748b'}"
				>
					B
				</span>
			{/if}
			<span class="text-surface-500-400">→</span>
			<span class="truncate text-surface-700-300">
				{#if row.destinations.length === 0}
					-
				{:else if row.destinations.length === 1}
					{row.destinations[0]}
				{:else}
					{m.trace_multiple_destinations()} ({row.destinations.length})
				{/if}
			</span>
			{#if row.residentialUnitCount > 0}
				<span class="rounded bg-error-500/15 px-1.5 py-0.5 text-xs font-medium text-error-500">
					{row.residentialUnitCount}
					{m.form_residential_units()}
				</span>
			{/if}
		</div>
	</div>

	<!-- Desktop table row -->
	<div
		class="hidden grid-cols-[60px_1fr_120px_1fr_80px_40px] items-center gap-2 border-b border-surface-200-800 px-4 py-3 transition-colors hover:bg-surface-100-900 sm:grid"
	>
		<button
			type="button"
			class="rounded bg-primary-500/15 px-2 py-1 font-mono text-sm font-medium text-primary-500 hover:bg-primary-500/25"
			onclick={() => traceFrom('fiber', row.fiberId)}
			title="Trace this fiber"
		>
			F{row.fiberNumber}
		</button>

		<div class="flex items-center gap-2 truncate">
			<button
				type="button"
				class="truncate rounded bg-success-500/15 px-2 py-1 font-mono text-sm font-medium text-success-500 hover:bg-success-500/25"
				onclick={() => traceFrom('cable', row.cableId)}
				title="Trace this cable"
			>
				{row.cableName}
			</button>
			{#if row.cableType}
				<span
					class="hidden truncate rounded bg-surface-100-900 px-2 py-0.5 text-xs text-surface-600-400 sm:inline"
				>
					{row.cableType}
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-1">
			{#if row.fiberColor}
				<span
					class="rounded px-2 py-0.5 text-[10px] font-medium text-white"
					style="background: {row.fiberColorHex || '#64748b'}"
				>
					{row.fiberColor}
				</span>
			{/if}
			{#if row.bundleColor}
				<span
					class="rounded px-2 py-0.5 text-[10px] font-medium text-white opacity-80"
					style="background: {row.bundleColorHex || '#64748b'}"
				>
					B
				</span>
			{/if}
		</div>

		<div class="truncate text-sm text-surface-700-300">
			{#if row.destinations.length === 0}
				<span class="text-surface-500-400">-</span>
			{:else if row.destinations.length === 1}
				{row.destinations[0]}
			{:else}
				<span title={row.destinations.join(', ')}>
					{m.trace_multiple_destinations()} ({row.destinations.length})
				</span>
			{/if}
		</div>

		<div class="text-center">
			{#if row.residentialUnitCount > 0}
				<span class="rounded bg-error-500/15 px-2 py-0.5 text-xs font-medium text-error-500">
					{row.residentialUnitCount}
				</span>
			{:else}
				<span class="text-surface-500-400">-</span>
			{/if}
		</div>

		<button
			type="button"
			class="flex items-center justify-center rounded p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-900-100"
			onclick={() => toggleRow(row.index)}
		>
			{#if expandedRows.has(row.index)}
				<IconChevronDown size={18} />
			{:else}
				<IconChevronRight size={18} />
			{/if}
		</button>
	</div>

	{#if expandedRows.has(row.index)}
		<div
			transition:slide={{ duration: 200 }}
			class="border-b border-surface-200-800 bg-surface-50-950 px-3 py-3 sm:px-4 sm:py-4"
		>
			{@render traceNode(row.tree, 0, true)}
		</div>
	{/if}
{/snippet}

{#snippet traceNode(
	/** @type {Record<string, any>} */ node,
	/** @type {number} */ depth,
	/** @type {boolean} */ isLastChild
)}
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

	<div class="relative" style="padding-left: {depth * STEP + INDENT + circleSize + 8}px">
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

		<!-- Circle marker -->
		<div
			class="absolute rounded-full border-2 border-primary-500 bg-surface-50-950"
			style="left: {lineX}px; top: {circleTop}px; width: {circleSize}px; height: {circleSize}px"
		></div>

		<!-- Waypoint content -->
		<div class="pb-4">
			<!-- Line 1: Fiber + Cable + Node -->
			<div class="flex flex-wrap items-center gap-1.5 py-1 text-xs">
				<button
					type="button"
					class="rounded bg-primary-500/15 px-2 py-0.5 font-mono font-medium text-primary-500 transition-colors hover:bg-primary-500/25"
					onclick={() => traceFrom('fiber', node.fiber.id)}
				>
					F{node.fiber.fiber_number_absolute}
				</button>
				<span class="text-surface-500-400">in</span>
				<button
					type="button"
					class="rounded bg-success-500/15 px-2 py-0.5 font-mono font-medium text-success-500 transition-colors hover:bg-success-500/25"
					onclick={() => traceFrom('cable', node.fiber.cable_id)}
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
						class="rounded bg-warning-500/15 px-2 py-0.5 font-mono font-medium text-warning-500 transition-colors hover:bg-warning-500/25"
						onclick={() => traceFrom('node', node.node.id)}
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
						{@render addressDetails(node.node.address)}
					{/if}

					{#if node.residential_units && node.residential_units.length > 0}
						{#each node.residential_units as ru (ru.id)}
							{@render residentialUnitDetails(ru)}
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Children -->
		{#if hasChildren}
			{#each node.children as child, i (child.fiber.id)}
				{@render traceNode(child, depth + 1, i === node.children.length - 1)}
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
				{#if splice.component.in_or_out}
					<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-xs text-surface-600-400">
						{splice.component.in_or_out}
					</span>
				{/if}
			</div>
		{/if}
		{#if splice.container_path && splice.container_path.length > 0}
			<div class="mt-1.5 text-xs">
				<span class="text-surface-600-400">{m.trace_container_path()}:</span>
				{#each splice.container_path as container, i (i)}
					{#if i > 0}<span class="mx-0.5 text-surface-500-400">→</span>{/if}
					<span class="rounded bg-surface-200-800 px-1 py-0.5 text-surface-600-400">
						{container.type}{container.name ? `: ${container.name}` : ''}
					</span>
				{/each}
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
			{m.trace_cable_path()}: {endpoints.cable_name}
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if endpoints.start_node}
				<div class="flex items-center gap-1">
					<span class="text-xs uppercase text-surface-600-400">{m.trace_start()}</span>
					<button
						type="button"
						class="rounded px-1.5 py-0.5 font-mono text-xs {endpoints.start_node.id ===
						currentNodeId
							? 'bg-primary-500/20 text-primary-500'
							: 'bg-surface-200-800 text-surface-900-100'} hover:bg-surface-300-700"
						onclick={() => traceFrom('node', endpoints.start_node.id)}
					>
						{endpoints.start_node.name || m.common_unknown()}
					</button>
					{#if endpoints.start_node.type}
						<span class="text-xs text-surface-600-400">{endpoints.start_node.type}</span>
					{/if}
				</div>
			{:else}
				<span class="text-xs text-surface-600-400">{m.trace_start_not_set()}</span>
			{/if}

			<span class="text-surface-500-400">↔</span>

			{#if endpoints.end_node}
				<div class="flex items-center gap-1">
					<span class="text-xs uppercase text-surface-600-400">{m.trace_end()}</span>
					<button
						type="button"
						class="rounded px-1.5 py-0.5 font-mono text-xs {endpoints.end_node.id === currentNodeId
							? 'bg-primary-500/20 text-primary-500'
							: 'bg-surface-200-800 text-surface-900-100'} hover:bg-surface-300-700"
						onclick={() => traceFrom('node', endpoints.end_node.id)}
					>
						{endpoints.end_node.name || m.common_unknown()}
					</button>
					{#if endpoints.end_node.type}
						<span class="text-xs text-surface-600-400">{endpoints.end_node.type}</span>
					{/if}
				</div>
			{:else}
				<span class="text-xs text-surface-600-400">{m.trace_end_not_set()}</span>
			{/if}
		</div>

		{#if endpoints.start_node?.address || endpoints.end_node?.address}
			<div class="mt-1.5 text-xs">
				{#if endpoints.start_node?.address}
					<div class="mb-0.5">
						<span class="text-surface-600-400">{m.trace_start_address()}</span>
						<button
							type="button"
							class="underline decoration-surface-300-700 underline-offset-2 text-surface-900-100 hover:text-primary-500 hover:decoration-primary-500"
							onclick={() => traceFrom('address', endpoints.start_node.address.id)}
						>
							{endpoints.start_node.address.street}
							{endpoints.start_node.address.housenumber}{endpoints.start_node.address.suffix || ''},
							{endpoints.start_node.address.zip_code}
							{endpoints.start_node.address.city}
						</button>
					</div>
				{/if}
				{#if endpoints.end_node?.address}
					<div>
						<span class="text-surface-600-400">{m.trace_end_address()}</span>
						<button
							type="button"
							class="underline decoration-surface-300-700 underline-offset-2 text-surface-900-100 hover:text-primary-500 hover:decoration-primary-500"
							onclick={() => traceFrom('address', endpoints.end_node.address.id)}
						>
							{endpoints.end_node.address.street}
							{endpoints.end_node.address.housenumber}{endpoints.end_node.address.suffix || ''},
							{endpoints.end_node.address.zip_code}
							{endpoints.end_node.address.city}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet addressDetails(/** @type {Record<string, any>} */ address)}
	<div class="rounded-lg border border-error-500/30 bg-error-500/5 px-3 py-1.5 text-xs">
		<div class="mb-1 flex items-center gap-2 text-error-500">
			<IconMapPin size={14} />
			<span class="font-semibold">{m.form_address({ count: 1 })}</span>
			<button
				type="button"
				class="rounded px-1.5 py-0.5 font-mono text-xs bg-error-500/15 text-error-500 transition-colors hover:bg-error-500/25"
				onclick={() => traceFrom('address', address.id)}
			>
				{address.street}
				{address.housenumber}{address.suffix || ''}, {address.zip_code}
				{address.city}
			</button>
		</div>
		<div class="flex flex-wrap gap-1.5 text-xs">
			{#if address.id_address}
				<span class="text-surface-900-100">{m.form_id_address()}: {address.id_address}</span>
			{/if}
			{#if address.district}
				<span class="text-surface-900-100">{m.form_district()}: {address.district}</span>
			{/if}
			{#if address.status_development}
				<span class="text-surface-900-100">{m.form_status()}: {address.status_development}</span>
			{/if}
			{#if address.project}
				<span class="text-surface-900-100">{m.form_project({ count: 1 })}: {address.project}</span>
			{/if}
			{#if address.flag}
				<span class="text-surface-900-100">{m.form_flag()}: {address.flag}</span>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet residentialUnitDetails(/** @type {Record<string, any>} */ ru)}
	<div class="rounded-lg border border-tertiary-500/30 bg-tertiary-500/5 px-3 py-1.5 text-xs">
		<div class="mb-1 flex items-center gap-2 text-tertiary-500">
			<IconHome size={14} />
			<span class="font-semibold">{m.section_residential_units({ count: 1 })}</span>
			<button
				type="button"
				class="rounded px-1.5 py-0.5 font-mono text-xs bg-tertiary-500/15 text-tertiary-500 transition-colors hover:bg-tertiary-500/25"
				onclick={() => traceFrom('residential_unit', ru.id)}
			>
				{ru.id_residential_unit || ru.id}
			</button>
		</div>
		<div class="flex flex-wrap gap-1.5 text-xs">
			{#if ru.floor !== null && ru.floor !== undefined}
				<span class="text-surface-900-100">{m.form_floor()}: {ru.floor}</span>
			{/if}
			{#if ru.side}
				<span class="text-surface-900-100">{m.form_side()}: {ru.side}</span>
			{/if}
			{#if ru.building_section}
				<span class="text-surface-900-100">{m.form_building_section()}: {ru.building_section}</span>
			{/if}
			{#if ru.type}
				<span class="text-surface-900-100">{m.form_residential_unit_type()}: {ru.type}</span>
			{/if}
			{#if ru.status}
				<span class="text-surface-900-100">{m.form_status()}: {ru.status}</span>
			{/if}
			{#if ru.resident_name}
				<span class="text-surface-900-100">{m.from_resident()}: {ru.resident_name}</span>
			{/if}
		</div>
		{#if ru.address}
			<div class="mt-1 text-xs">
				<span class="text-surface-600-400">{m.trace_at_address()}</span>
				<button
					type="button"
					class="underline decoration-surface-300-700 underline-offset-2 text-surface-900-100 hover:text-primary-500 hover:decoration-primary-500"
					onclick={() => traceFrom('address', ru.address.id)}
				>
					{ru.address.street}
					{ru.address.housenumber}{ru.address.suffix || ''},
					{ru.address.zip_code}
					{ru.address.city}
				</button>
			</div>
		{/if}
	</div>
{/snippet}
