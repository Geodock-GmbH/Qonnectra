<script lang="ts">
	import type {
		AddressInfo,
		FiberPathNode,
		FiberWaypoint,
		ResidentialUnitInfo
	} from '$lib/types/trace';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import {
		IconChevronDown,
		IconChevronRight,
		IconHome,
		IconMapPin,
		IconSearch
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { traceFrom } from '$lib/utils/traceUtils';

	import ColorChip from './ColorChip.svelte';
	import TraceCableEndpoints from './TraceCableEndpoints.svelte';
	import TraceTreeBranch from './TraceTreeBranch.svelte';
	import TraceWaypointDetails from './TraceWaypointDetails.svelte';

	interface Props {
		/** Array of fiber path tree objects */
		traceTrees: FiberPathNode[];
	}

	/** A flattened fiber-path row derived from a tree for the virtual table. */
	interface FiberPathRow {
		index: number;
		fiberNumber: number;
		fiberId?: string;
		cableId?: string;
		cableName: string;
		cableType?: string;
		bundleColor?: string;
		bundleColorHex?: string;
		fiberColor?: string;
		fiberColorHex?: string;
		destinations: string[];
		residentialUnitCount: number;
		tree: FiberPathNode;
	}

	let { traceTrees }: Props = $props();

	let searchQuery = $state('');
	let expandedRows = new SvelteSet<number>();
	let scrollTop = $state(0);

	const TABLE_ROW_HEIGHT = 52;
	const CARD_ROW_HEIGHT = 80;
	const BUFFER_SIZE = 10;
	const CONTAINER_HEIGHT = 600;

	/** Tailwind's `sm` breakpoint, where the mobile cards turn into table rows. */
	const tableLayout = new MediaQuery('min-width: 40rem', true);

	/** Every row is pinned to this height, which the virtual scroll offsets rely on. */
	const rowHeight = $derived(tableLayout.current ? TABLE_ROW_HEIGHT : CARD_ROW_HEIGHT);

	/**
	 * Extract destinations from a tree (recursive)
	 * @param tree
	 */
	function collectDestinations(tree: FiberPathNode): string[] {
		const destinations: string[] = [];

		/** @param node */
		function traverse(node: FiberPathNode) {
			if (node.node?.name) {
				destinations.push(node.node.name);
			}
			if (node.cable_endpoints?.end_node?.name) {
				destinations.push(node.cable_endpoints.end_node.name);
			}
			if (node.children) {
				for (const child of node.children) {
					traverse(child);
				}
			}
		}

		traverse(tree);
		return [...new Set(destinations)];
	}

	/**
	 * Count residential units in a tree (recursive)
	 * @param tree
	 */
	function countResidentialUnits(tree: FiberPathNode): number {
		let count = 0;

		/** @param node */
		function traverse(node: FiberPathNode) {
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
	 * @param tree
	 * @param index
	 * @returns Flattened row data including fiber info, colors, destinations, and residential unit count
	 */
	function extractRowData(tree: FiberPathNode, index: number): FiberPathRow {
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
			const destinationMatch = row.destinations.some((d: string) =>
				d.toLowerCase().includes(query)
			);
			return fiberMatch || cableMatch || destinationMatch;
		});
	});

	let visibleRange = $derived.by(() => {
		const start = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_SIZE);
		const visibleCount = Math.ceil(CONTAINER_HEIGHT / rowHeight);
		const end = Math.min(filteredRows.length, start + visibleCount + BUFFER_SIZE * 2);
		return { start, end };
	});

	let isVirtual = $derived(expandedRows.size === 0);

	let visibleRows = $derived(
		isVirtual ? filteredRows.slice(visibleRange.start, visibleRange.end) : filteredRows
	);

	let totalHeight = $derived(filteredRows.length * rowHeight);

	let offsetY = $derived(visibleRange.start * rowHeight);

	/**
	 * Toggle the expanded/collapsed state of a table row
	 * @param index - Row index to toggle
	 */
	function toggleRow(index: number): void {
		if (expandedRows.has(index)) {
			expandedRows.delete(index);
		} else {
			expandedRows.add(index);
		}
	}

	/**
	 * Update scroll position for virtual scrolling calculations
	 * @param e - Scroll event from the container
	 */
	function handleScroll(e: Event & { currentTarget: HTMLElement }): void {
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
		onscroll={isVirtual ? handleScroll : undefined}
		class="relative overflow-auto border border-surface-200-800 sm:rounded-b-lg"
		style="max-height: min({CONTAINER_HEIGHT}px, 70vh)"
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

{#snippet rowColorChips(row: FiberPathRow)}
	{#if row.fiberColor}
		<ColorChip hex={row.fiberColorHex} class="px-2 py-0.5 text-[10px]">{row.fiberColor}</ColorChip>
	{/if}
	{#if row.bundleColor}
		<ColorChip hex={row.bundleColorHex} class="px-2 py-0.5 text-[10px] opacity-80">B</ColorChip>
	{/if}
{/snippet}

{#snippet tableRow(row: FiberPathRow)}
	<!-- Mobile card view -->
	<div
		class="flex flex-col justify-center gap-2 border-b border-surface-200-800 px-3 sm:hidden"
		style:height="{CARD_ROW_HEIGHT}px"
	>
		<div class="flex items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-2">
				<button
					type="button"
					class="shrink-0 rounded bg-primary-500/15 px-2 py-1 font-mono text-sm font-medium text-primary-500 hover:bg-primary-500/25"
					onclick={() => traceFrom('fiber', row.fiberId ?? '')}
				>
					F{row.fiberNumber}
				</button>
				<button
					type="button"
					class="truncate rounded bg-success-500/15 px-2 py-1 font-mono text-sm font-medium text-success-500 hover:bg-success-500/25"
					onclick={() => traceFrom('cable', row.cableId ?? '')}
				>
					{row.cableName}
				</button>
			</div>
			<button
				type="button"
				class="flex shrink-0 items-center justify-center rounded p-1 text-surface-500-400 hover:bg-surface-200-800 hover:text-surface-900-100"
				onclick={() => toggleRow(row.index)}
			>
				{#if expandedRows.has(row.index)}
					<IconChevronDown size={18} />
				{:else}
					<IconChevronRight size={18} />
				{/if}
			</button>
		</div>
		<div class="flex items-center gap-2 text-xs">
			{@render rowColorChips(row)}
			<span class="text-surface-500-400">→</span>
			<span class="min-w-0 flex-1 truncate text-surface-700-300">
				{#if row.destinations.length === 0}
					-
				{:else if row.destinations.length === 1}
					{row.destinations[0]}
				{:else}
					{m.trace_multiple_destinations()} ({row.destinations.length})
				{/if}
			</span>
			{#if row.residentialUnitCount > 0}
				<span
					class="shrink-0 whitespace-nowrap rounded bg-error-500/15 px-1.5 py-0.5 text-xs font-medium text-error-500"
				>
					{row.residentialUnitCount}
					{m.form_residential_units()}
				</span>
			{/if}
		</div>
	</div>

	<!-- Desktop table row -->
	<div
		class="hidden grid-cols-[60px_1fr_120px_1fr_80px_40px] items-center gap-2 border-b border-surface-200-800 px-4 transition-colors hover:bg-surface-100-900 sm:grid"
		style:height="{TABLE_ROW_HEIGHT}px"
	>
		<button
			type="button"
			class="rounded bg-primary-500/15 px-2 py-1 font-mono text-sm font-medium text-primary-500 hover:bg-primary-500/25"
			onclick={() => traceFrom('fiber', row.fiberId ?? '')}
			title="Trace this fiber"
		>
			F{row.fiberNumber}
		</button>

		<div class="flex items-center gap-2 truncate">
			<button
				type="button"
				class="truncate rounded bg-success-500/15 px-2 py-1 font-mono text-sm font-medium text-success-500 hover:bg-success-500/25"
				onclick={() => traceFrom('cable', row.cableId ?? '')}
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
			{@render rowColorChips(row)}
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
			{@render traceNode(row.tree as FiberWaypoint, 0, true)}
		</div>
	{/if}
{/snippet}

{#snippet traceNode(node: FiberWaypoint, depth: number, isLastChild: boolean)}
	{@const children = node.children ?? []}
	<TraceTreeBranch
		{depth}
		{isLastChild}
		hasChildren={children.length > 0}
		markerClass="border-primary-500 bg-surface-50-950"
	>
		<!-- Line 1: Fiber + Cable + Node -->
		<div class="flex flex-wrap items-center gap-1.5 py-1 text-xs">
			<button
				type="button"
				class="rounded bg-primary-500/15 px-2 py-0.5 font-mono font-medium text-primary-500 transition-colors hover:bg-primary-500/25"
				onclick={() => traceFrom('fiber', node.fiber.id ?? '')}
			>
				F{node.fiber.fiber_number_absolute}
			</button>
			<span class="text-surface-500-400">in</span>
			<button
				type="button"
				class="rounded bg-success-500/15 px-2 py-0.5 font-mono font-medium text-success-500 transition-colors hover:bg-success-500/25"
				onclick={() => traceFrom('cable', node.fiber.cable_id ?? '')}
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
					onclick={() => traceFrom('node', node.node?.id ?? '')}
				>
					{node.node.name}
				</button>
			{/if}
		</div>

		<TraceWaypointDetails {node}>
			{#snippet details()}
				{#if node.cable_endpoints && (node.cable_endpoints.start_node || node.cable_endpoints.end_node)}
					<TraceCableEndpoints endpoints={node.cable_endpoints} currentNodeId={node.node?.id} />
				{/if}

				{#if node.node?.address}
					{@render addressDetails(node.node.address)}
				{/if}

				{#if node.residential_units && node.residential_units.length > 0}
					{#each node.residential_units as ru (ru.id)}
						{@render residentialUnitDetails(ru)}
					{/each}
				{/if}
			{/snippet}
		</TraceWaypointDetails>

		{#snippet branches()}
			{#each children as child, i (`${child.fiber?.id}-${i}`)}
				{@render traceNode(child as FiberWaypoint, depth + 1, i === children.length - 1)}
			{/each}
		{/snippet}
	</TraceTreeBranch>
{/snippet}

{#snippet addressDetails(address: AddressInfo)}
	<div class="rounded-lg border border-error-500/30 bg-error-500/5 px-3 py-1.5 text-xs">
		<div class="mb-1 flex flex-wrap items-center gap-2 text-error-500">
			<IconMapPin size={14} class="shrink-0" />
			<span class="font-semibold">{m.form_address({ count: 1 })}</span>
			<button
				type="button"
				class="min-w-0 rounded px-1.5 py-0.5 text-left font-mono text-xs wrap-anywhere bg-error-500/15 text-error-500 transition-colors hover:bg-error-500/25"
				onclick={() => traceFrom('address', address.id ?? '')}
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

{#snippet residentialUnitDetails(ru: ResidentialUnitInfo)}
	<div class="rounded-lg border border-tertiary-500/30 bg-tertiary-500/5 px-3 py-1.5 text-xs">
		<div class="mb-1 flex flex-wrap items-center gap-2 text-tertiary-500">
			<IconHome size={14} class="shrink-0" />
			<span class="font-semibold">{m.section_residential_units({ count: 1 })}</span>
			<button
				type="button"
				class="min-w-0 rounded px-1.5 py-0.5 text-left font-mono text-xs wrap-anywhere bg-tertiary-500/15 text-tertiary-500 transition-colors hover:bg-tertiary-500/25"
				onclick={() => traceFrom('residential_unit', ru.id ?? '')}
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
					class="text-left text-surface-900-100 underline decoration-surface-300-700 underline-offset-2 hover:text-primary-500 hover:decoration-primary-500"
					onclick={() => traceFrom('address', ru.address?.id ?? '')}
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
