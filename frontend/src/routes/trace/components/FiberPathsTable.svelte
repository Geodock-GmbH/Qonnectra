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

	let visibleRows = $derived(filteredRows.slice(visibleRange.start, visibleRange.end));

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

	<div
		class="grid grid-cols-[60px_1fr_120px_1fr_80px_40px] gap-2 rounded-t-lg border border-b-0 border-surface-200-800 bg-surface-100-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-surface-600-400"
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
		onscroll={handleScroll}
		class="relative overflow-auto rounded-b-lg border border-surface-200-800"
		style="height: {CONTAINER_HEIGHT}px"
	>
		<div style="height: {totalHeight}px; position: relative;">
			<div style="transform: translateY({offsetY}px);">
				{#each visibleRows as row (row.fiberId ?? row.index)}
					<div
						class="grid grid-cols-[60px_1fr_120px_1fr_80px_40px] items-center gap-2 border-b border-surface-200-800 px-4 py-3 transition-colors hover:bg-surface-100-900"
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
								<span
									class="rounded bg-error-500/15 px-2 py-0.5 text-xs font-medium text-error-500"
								>
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
							class="border-b border-surface-200-800 bg-surface-50-950 px-4 py-4"
						>
							{@render traceNode(row.tree, 0)}
						</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<div class="text-center text-xs text-surface-500-400">
		{filteredRows.length}
		{filteredRows.length === 1 ? m.form_fiber() : m.form_fibers()}
	</div>
</div>

{#snippet traceNode(/** @type {Record<string, any>} */ node, /** @type {number} */ depth)}
	<div class="relative" style="padding-left: {depth * 1.5}rem">
		{#if depth > 0}
			<div
				class="absolute top-0 h-full w-0.5 bg-linear-to-b from-primary-500/40 to-surface-200-800"
				style="left: {(depth - 1) * 1.5 + 0.25}rem"
			></div>
		{/if}

		<div class="mb-3">
			<div class="flex flex-wrap items-center gap-2 py-2">
				<button
					type="button"
					class="rounded bg-primary-500/15 px-2.5 py-1 font-mono text-sm font-medium text-primary-500 hover:bg-primary-500/25"
					onclick={() => traceFrom('fiber', node.fiber.id)}
					title="Trace this fiber"
				>
					F{node.fiber.fiber_number_absolute}
				</button>
				<span class="text-xs text-surface-600-400">in</span>
				<button
					type="button"
					class="rounded bg-success-500/15 px-2.5 py-1 font-mono text-sm font-medium text-success-500 hover:bg-success-500/25"
					onclick={() => traceFrom('cable', node.fiber.cable_id)}
					title="Trace this cable"
				>
					{node.fiber.cable_name}
				</button>
				{#if node.fiber.cable_type}
					<span class="rounded bg-surface-100-900 px-2 py-0.5 text-xs text-surface-600-400">
						{node.fiber.cable_type}
					</span>
				{/if}
				{#if node.node}
					<span class="text-surface-500-400">→</span>
					<button
						type="button"
						class="rounded bg-warning-500/15 px-2.5 py-1 font-mono text-sm font-medium text-warning-500 hover:bg-warning-500/25"
						onclick={() => traceFrom('node', node.node.id)}
						title="Trace this node"
					>
						{node.node.name}
					</button>
					<span class="text-xs text-surface-600-400">{node.direction}</span>
				{/if}
			</div>

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

		{#if node.children && node.children.length > 0}
			{#each node.children as child (child.fiber.id)}
				{@render traceNode(child, depth + 1)}
			{/each}
		{/if}
	</div>
{/snippet}

{#snippet fiberDetails(/** @type {Record<string, any>} */ fiber)}
	<div class="flex flex-wrap gap-2 pb-2 pl-1 text-xs">
		{#if fiber.bundle_number !== null && fiber.bundle_number !== undefined}
			<span class="text-surface-600-400"
				>{m.form_bundle()}: <code class="text-surface-700-300">{fiber.bundle_number}</code></span
			>
		{/if}
		{#if fiber.fiber_number_in_bundle}
			<span class="text-surface-600-400"
				>{m.trace_in_bundle()}:
				<code class="text-surface-700-300">{fiber.fiber_number_in_bundle}</code></span
			>
		{/if}
		{#if fiber.fiber_color}
			<span
				class="rounded px-2 py-0.5 text-[10px] font-medium text-white"
				style="background: {fiber.fiber_color_hex || '#64748b'}"
			>
				{fiber.fiber_color}
			</span>
		{/if}
		{#if fiber.bundle_color}
			<span
				class="rounded px-2 py-0.5 text-[10px] font-medium text-white opacity-80"
				style="background: {fiber.bundle_color_hex || '#64748b'}"
			>
				B: {fiber.bundle_color}
			</span>
		{/if}
		{#if fiber.layer}
			<span class="text-surface-600-400"
				>{m.form_layer()}: <code class="text-surface-700-300">{fiber.layer}</code></span
			>
		{/if}
		{#if fiber.status}
			<span class="rounded bg-surface-100-900 px-2 py-0.5 text-surface-600-400">{fiber.status}</span
			>
		{/if}
	</div>
{/snippet}

{#snippet spliceDetails(/** @type {Record<string, any>} */ splice)}
	<div class="mb-2 ml-1 rounded-lg border-l-2 border-secondary-500 bg-surface-100-900 p-3 text-sm">
		<div class="mb-2 flex items-center gap-2 text-secondary-500">
			<IconArrowsSplit size={14} />
			<span class="font-semibold">{m.trace_splice()}</span>
			<code class="text-xs text-surface-600-400">{m.form_port()} {splice.port_number}</code>
		</div>
		{#if splice.component}
			<div class="flex flex-wrap gap-2">
				{#if splice.component.type}
					<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600-400">
						{splice.component.type}
					</span>
				{/if}
				{#if splice.component.slot_start !== null && splice.component.slot_end !== null}
					<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600-400">
						{m.form_slot({ count: 2 })}
						{splice.component.slot_start}-{splice.component.slot_end}
					</span>
				{/if}
				{#if splice.component.slot_side}
					<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600-400">
						{m.form_side()}: {splice.component.slot_side}
					</span>
				{/if}
				{#if splice.component.in_or_out}
					<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600-400">
						{splice.component.in_or_out}
					</span>
				{/if}
			</div>
		{/if}
		{#if splice.container_path && splice.container_path.length > 0}
			<div class="mt-2 border-t border-surface-200-800 pt-2 text-xs">
				<span class="text-surface-600-400">{m.trace_container_path()}:</span>
				{#each splice.container_path as container, i (i)}
					{#if i > 0}<span class="mx-1 text-surface-500-400">→</span>{/if}
					<span class="rounded bg-surface-200-800 px-1.5 py-0.5 text-surface-600-400">
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
	<div class="mb-2 ml-1 rounded-lg border-l-2 border-primary-500 bg-surface-100-900 p-3 text-sm">
		<div class="mb-2 font-semibold text-primary-500">
			{m.trace_cable_path()}: {endpoints.cable_name}
		</div>
		<div class="flex flex-wrap items-center gap-3">
			{#if endpoints.start_node}
				<div class="flex items-center gap-2">
					<span class="text-xs uppercase text-surface-600-400">{m.trace_start()}</span>
					<button
						type="button"
						class="rounded bg-surface-200-800 px-2.5 py-1 font-mono text-sm {endpoints.start_node
							.id === currentNodeId
							? 'bg-primary-500/20 text-primary-500'
							: 'text-surface-900-100'} hover:bg-surface-300-700"
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
				<div class="flex items-center gap-2">
					<span class="text-xs uppercase text-surface-600-400">{m.trace_end()}</span>
					<button
						type="button"
						class="rounded bg-surface-200-800 px-2.5 py-1 font-mono text-sm {endpoints.end_node
							.id === currentNodeId
							? 'bg-primary-500/20 text-primary-500'
							: 'text-surface-900-100'} hover:bg-surface-300-700"
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
			<div class="mt-2 border-t border-surface-200-800 pt-2 text-xs">
				{#if endpoints.start_node?.address}
					<div class="mb-1">
						<span class="text-surface-600-400">{m.trace_start_address()}</span>
						<button
							type="button"
							class="underline decoration-surface-300-700 underline-offset-2 text-surface-600-400 hover:text-primary-500 hover:decoration-primary-500"
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
							class="underline decoration-surface-300-700 underline-offset-2 text-surface-600-400 hover:text-primary-500 hover:decoration-primary-500"
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
	<div class="mb-2 ml-1 rounded-lg border-l-2 border-error-500 bg-surface-100-900 p-3 text-sm">
		<div class="mb-2 flex items-center gap-2 text-error-500">
			<IconMapPin size={14} />
			<span class="font-semibold">{m.form_address({ count: 1 })}</span>
			<button
				type="button"
				class="rounded px-2 py-0.5 font-mono text-sm bg-error-500/15 text-error-500 transition-colors hover:bg-error-500/25"
				onclick={() => traceFrom('address', address.id)}
			>
				{address.street}
				{address.housenumber}{address.suffix || ''}, {address.zip_code}
				{address.city}
			</button>
		</div>
		<div class="flex flex-wrap gap-2 text-xs">
			{#if address.id_address}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_id_address()}:</span>
					{address.id_address}</span
				>
			{/if}
			{#if address.district}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_district()}:</span> {address.district}</span
				>
			{/if}
			{#if address.status_development}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_status()}:</span>
					{address.status_development}</span
				>
			{/if}
			{#if address.project}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_project({ count: 1 })}:</span>
					{address.project}</span
				>
			{/if}
			{#if address.flag}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_flag()}:</span> {address.flag}</span
				>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet residentialUnitDetails(/** @type {Record<string, any>} */ ru)}
	<div class="mb-2 ml-1 rounded-lg border-l-2 border-tertiary-500 bg-surface-100-900 p-3 text-sm">
		<div class="mb-2 flex items-center gap-2 text-tertiary-500">
			<IconHome size={14} />
			<span class="font-semibold">{m.section_residential_units({ count: 1 })}</span>
			<button
				type="button"
				class="rounded px-2 py-0.5 font-mono text-sm bg-tertiary-500/15 text-tertiary-500 transition-colors hover:bg-tertiary-500/25"
				onclick={() => traceFrom('residential_unit', ru.id)}
			>
				{ru.id_residential_unit || ru.id}
			</button>
		</div>
		<div class="flex flex-wrap gap-2 text-xs">
			{#if ru.floor !== null && ru.floor !== undefined}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_floor()}:</span> {ru.floor}</span
				>
			{/if}
			{#if ru.side}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_side()}:</span> {ru.side}</span
				>
			{/if}
			{#if ru.building_section}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_building_section()}:</span>
					{ru.building_section}</span
				>
			{/if}
			{#if ru.type}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_residential_unit_type()}:</span>
					{ru.type}</span
				>
			{/if}
			{#if ru.status}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.form_status()}:</span> {ru.status}</span
				>
			{/if}
			{#if ru.resident_name}
				<span class="text-surface-600-400"
					><span class="text-surface-600-400">{m.from_resident()}:</span> {ru.resident_name}</span
				>
			{/if}
		</div>
		{#if ru.address}
			<div class="mt-2 border-t border-surface-200-800 pt-2 text-xs">
				<span class="text-surface-600-400">{m.trace_at_address()}</span>
				<button
					type="button"
					class="underline decoration-surface-300-700 underline-offset-2 text-surface-600-400 hover:text-primary-500 hover:decoration-primary-500"
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
