<script>
	import { cubicOut } from 'svelte/easing';
	import { fly, slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import {
		IconArrowsSplit,
		IconChevronRight,
		IconDownload,
		IconHome,
		IconMapPin,
		IconNetwork
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import FiberPathsTable from './FiberPathsTable.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {Object} result - The trace result data
	 * @property {string} entryType - The entry type (fiber, cable, node, address, residential_unit)
	 * @property {string} entryId - The entry UUID
	 * @property {boolean} [includeGeometry] - Whether geometry was included
	 */

	/** @type {Props} */
	let { result, entryType, entryId, includeGeometry = false } = $props();

	/**
	 * Navigate to trace a different entity
	 * @param {string} type - Entity type
	 * @param {string} id - Entity UUID
	 */
	function traceFrom(type, id) {
		const typeSlug = type === 'residential_unit' ? 'residential-unit' : type;
		goto(`/trace/${typeSlug}/${id}`);
	}

	/**
	 * Get translated entry type label
	 * @param {string} type - Entry type from backend
	 */
	function getEntryTypeLabel(type) {
		const typeMap = {
			fiber: m.form_fiber(),
			cable: m.form_cables(),
			node: m.form_node(),
			address: m.form_address({ count: 1 }),
			residential_unit: m.section_residential_units({ count: 1 })
		};
		return typeMap[type] || type || m.common_unknown();
	}

	function hasGeometries(traceResult) {
		if (!traceResult?.cable_infrastructure) return false;
		for (const infra of Object.values(traceResult.cable_infrastructure)) {
			if (infra.merged_geometry) return true;
			if (infra.trenches?.some((t) => t.geometry)) return true;
		}
		return false;
	}

	function buildGeoJSON(traceResult) {
		const features = [];
		const cableInfra = traceResult.cable_infrastructure || {};

		for (const [cableId, infra] of Object.entries(cableInfra)) {
			if (infra.merged_geometry) {
				features.push({
					type: 'Feature',
					properties: {
						cable_id: cableId,
						conduit_name: infra.conduit?.name || null,
						conduit_type: infra.conduit?.type || null,
						microduct_number: infra.microduct?.number || null,
						microduct_color: infra.microduct?.color || null,
						total_length: infra.total_length || null,
						trench_count: infra.trenches?.length || 0,
						geometry_mode: 'merged'
					},
					geometry: infra.merged_geometry
				});
			} else if (infra.trenches) {
				for (const trench of infra.trenches) {
					if (trench.geometry) {
						features.push({
							type: 'Feature',
							properties: {
								cable_id: cableId,
								trench_id: trench.id,
								id_trench: trench.id_trench,
								construction_type: trench.construction_type,
								surface: trench.surface,
								length: trench.length,
								conduit_name: infra.conduit?.name || null,
								conduit_type: infra.conduit?.type || null,
								microduct_number: infra.microduct?.number || null,
								microduct_color: infra.microduct?.color || null,
								geometry_mode: 'segments'
							},
							geometry: trench.geometry
						});
					}
				}
			}
		}

		return {
			type: 'FeatureCollection',
			name: 'fiber_trace_infrastructure',
			crs: {
				type: 'name',
				properties: { name: 'urn:ogc:def:crs:EPSG::25832' }
			},
			features
		};
	}

	function downloadGeoJSON() {
		if (!result) return;
		const geojson = buildGeoJSON(result);
		const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const entryTypeLabel = result.entry_point?.type || 'trace';
		const entryIdShort = result.entry_point?.id?.slice(0, 8) || 'unknown';
		a.download = `fiber-trace-${entryTypeLabel}-${entryIdShort}.geojson`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

{#if result}
	<div class="space-y-8" transition:fly={{ y: 30, duration: 400, easing: cubicOut }}>
		<!-- Statistics Cards -->
		<section>
			<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-surface-900-100">
				<span class="h-5 w-1 rounded bg-primary-500"></span>
				{m.trace_statistics()}
			</h2>
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{@render statCard(m.form_fibers(), result.statistics.total_fibers, 'text-primary-500')}
				{@render statCard(m.nav_node(), result.statistics.total_nodes, 'text-success-500')}
				{@render statCard(m.trace_splice(), result.statistics.total_splices, 'text-secondary-500')}
				{@render statCard(m.form_cables(), result.statistics.total_cables ?? 0, 'text-warning-500')}
				{@render statCard(
					m.form_selected_trenches(),
					result.statistics.total_trenches ?? 0,
					'text-tertiary-500'
				)}
				{@render statCard(m.form_addresses(), result.statistics.total_addresses, 'text-error-500')}
				{@render statCard(
					m.form_residential_units(),
					result.statistics.total_residential_units,
					'text-primary-400'
				)}
				{@render statBadge(m.trace_branches(), result.statistics.has_branches)}
			</div>
		</section>

		<!-- Download Button -->
		{#if includeGeometry && hasGeometries(result)}
			<div class="flex justify-center">
				<button
					type="button"
					onclick={downloadGeoJSON}
					class="flex items-center gap-3 rounded-lg border border-success-500 px-5 py-2.5 font-medium text-success-500 transition-colors hover:bg-success-500/10"
				>
					<IconDownload size={20} />
					<span>{m.trace_download_geojson()}</span>
					<span class="border-l border-surface-200-800 pl-3 text-xs text-surface-600-400">
						{result.statistics.total_trenches}
						{m.form_selected_trenches().toLowerCase()} · EPSG:25832
					</span>
				</button>
			</div>
		{/if}

		<!-- Entry Point -->
		<section>
			<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-surface-900-100">
				<span class="h-5 w-1 rounded bg-primary-500"></span>
				{m.trace_entry_point()}
			</h2>
			<div class="flex items-center gap-4 rounded-lg border border-surface-200-800 px-4 py-3">
				<span
					class="rounded border border-primary-500 bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-500"
				>
					{getEntryTypeLabel(result.entry_point?.type || entryType)}
				</span>
				<span class="font-medium text-surface-900-100">
					{result.entry_point?.name || result.entry_point?.id || entryId || '-'}
				</span>
			</div>
		</section>

		<!-- Cable Infrastructure -->
		{#if result.cable_infrastructure && Object.keys(result.cable_infrastructure).length > 0}
			<section>
				<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-surface-900-100">
					<span class="h-5 w-1 rounded bg-primary-500"></span>
					{m.trace_cable_infrastructure()}
				</h2>
				<div class="space-y-3">
					{#each Object.entries(result.cable_infrastructure) as [cableId, infra] (cableId)}
						{@render infrastructureCard(cableId, infra)}
					{/each}
				</div>
			</section>
		{/if}

		<!-- Trace Tree -->
		<section>
			<h2 class="mb-4 flex items-center gap-3 text-lg font-semibold text-surface-900-100">
				<span class="h-5 w-1 rounded bg-primary-500"></span>
				{m.trace_trace_tree()}
			</h2>
			{#if result.trace_tree}
				<div class="rounded-xl border border-surface-200-800 p-6">
					{@render traceNode(result.trace_tree, 0)}
				</div>
			{:else if result.trace_trees && result.trace_trees.length > 0}
				<FiberPathsTable traceTrees={result.trace_trees} />
			{:else}
				<div class="rounded-xl border border-surface-200-800 p-6">
					<div class="py-8 text-center text-surface-600-400">{m.trace_no_trace_data()}</div>
				</div>
			{/if}
		</section>
	</div>
{/if}

<!-- Stat Card Snippet -->
{#snippet statCard(label, value, colorClass)}
	<div class="flex flex-col items-center rounded-lg border border-surface-200-800 p-4">
		<span class="font-mono text-2xl font-bold {colorClass}">{value}</span>
		<span class="mt-1 text-xs font-medium uppercase tracking-wide text-surface-600-400"
			>{label}</span
		>
	</div>
{/snippet}

<!-- Stat Badge Snippet -->
{#snippet statBadge(label, value)}
	<div class="flex flex-col items-center rounded-lg border border-surface-200-800 p-4">
		<span
			class="font-mono text-2xl font-bold {value ? 'text-success-500' : 'text-surface-600-400'}"
		>
			{value ? m.common_yes() : m.common_no()}
		</span>
		<span class="mt-1 text-xs font-medium uppercase tracking-wide text-surface-600-400"
			>{label}</span
		>
	</div>
{/snippet}

<!-- Infrastructure Card Snippet -->
{#snippet infrastructureCard(cableId, infra)}
	<details class="group rounded-lg border border-surface-200-800">
		<summary class="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-surface-100-900">
			<span class="font-mono text-sm font-semibold text-warning-500">
				{infra.cable_name || cableId.slice(0, 8) + '...'}
			</span>
			{#if infra.conduit}
				<span class="rounded bg-surface-100-900 px-2 py-0.5 text-xs text-surface-600-400">
					{infra.conduit.name}
				</span>
			{/if}
			<IconChevronRight
				size={16}
				class="ml-auto text-surface-500-400 transition-transform group-open:rotate-90"
			/>
		</summary>
		<div class="space-y-3 border-t border-surface-200-800 p-4">
			{#if infra.microduct}
				<div class="rounded-lg bg-surface-100-900 p-3">
					<span class="mb-2 block text-xs font-semibold uppercase tracking-wide text-secondary-500"
						>{m.form_microduct({ count: 1 })}</span
					>
					<div class="flex flex-wrap items-center gap-2">
						<span class="font-mono font-semibold text-surface-900-100"
							>#{infra.microduct.number}</span
						>
						<span
							class="rounded px-2 py-0.5 text-xs font-medium text-white"
							style="background: {infra.microduct.color_hex || '#ec4899'}"
						>
							{infra.microduct.color}
						</span>
						{#if infra.microduct.status}
							<span class="text-xs text-surface-600-400">{infra.microduct.status}</span>
						{/if}
					</div>
				</div>
			{/if}

			{#if infra.conduit}
				<div class="rounded-lg bg-surface-100-900 p-3">
					<span class="mb-2 block text-xs font-semibold uppercase tracking-wide text-tertiary-500"
						>{m.form_conduit({ count: 1 })}</span
					>
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-sm text-surface-900-100">{infra.conduit.name}</span>
						{#if infra.conduit.type}
							<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600-400">
								{infra.conduit.type}
							</span>
						{/if}
					</div>
				</div>
			{/if}

			{#if infra.merged_geometry}
				<div class="rounded-lg bg-surface-100-900 p-3">
					<span class="mb-2 block text-xs font-semibold uppercase tracking-wide text-success-500"
						>{m.trace_geometry()}</span
					>
					<div class="flex flex-wrap items-center gap-2">
						<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600-400">
							{infra.merged_geometry.type}
						</span>
						{#if infra.total_length}
							<span class="text-sm text-surface-600-400">{infra.total_length.toFixed(1)}m</span>
						{/if}
					</div>
				</div>
			{/if}

			{#if infra.trenches && infra.trenches.length > 0}
				<div class="rounded-lg bg-surface-100-900 p-3">
					<span class="mb-2 block text-xs font-semibold uppercase tracking-wide text-warning-500">
						{m.form_selected_trenches()} ({infra.trenches.length})
					</span>
					<div class="space-y-1.5">
						{#each infra.trenches as trench (trench.id)}
							<div
								class="flex flex-wrap items-center gap-2 rounded bg-surface-200-800 px-3 py-2 text-sm"
							>
								<span class="font-mono font-medium text-surface-900-100">{trench.id_trench}</span>
								{#if trench.construction_type}
									<span
										class="rounded bg-surface-300-700 px-1.5 py-0.5 text-xs text-surface-600-400"
									>
										{trench.construction_type}
									</span>
								{/if}
								{#if trench.length}
									<span class="text-xs text-surface-600-400">{trench.length.toFixed(1)}m</span>
								{/if}
								{#if trench.geometry}
									<span
										class="rounded bg-success-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success-500"
									>
										GEO
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</details>
{/snippet}

<!-- Trace Node Snippet -->
{#snippet traceNode(node, depth)}
	<div class="relative" style="padding-left: {depth * 1.5}rem">
		{#if depth > 0}
			<div
				class="absolute top-0 h-full w-0.5 bg-gradient-to-b from-primary-500/40 to-surface-200-800"
				style="left: {(depth - 1) * 1.5 + 0.25}rem"
			></div>
		{/if}

		<div class="mb-3">
			<!-- Fiber Info -->
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

			<!-- Fiber Details -->
			{@render fiberDetails(node.fiber)}

			<!-- Splice Info -->
			{#if node.splice}
				{@render spliceDetails(node.splice)}
			{/if}

			<!-- Cable Endpoints -->
			{#if node.cable_endpoints && (node.cable_endpoints.start_node || node.cable_endpoints.end_node)}
				{@render cableEndpointsDetails(node.cable_endpoints, node.node?.id)}
			{/if}

			<!-- Address -->
			{#if node.node?.address}
				{@render addressDetails(node.node.address)}
			{/if}

			<!-- Residential Units -->
			{#if node.residential_units && node.residential_units.length > 0}
				{#each node.residential_units as ru (ru.id)}
					{@render residentialUnitDetails(ru)}
				{/each}
			{/if}
		</div>

		<!-- Children -->
		{#if node.children && node.children.length > 0}
			{#each node.children as child (child.fiber.id)}
				{@render traceNode(child, depth + 1)}
			{/each}
		{/if}
	</div>
{/snippet}

<!-- Fiber Details Snippet -->
{#snippet fiberDetails(fiber)}
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

<!-- Splice Details Snippet -->
{#snippet spliceDetails(splice)}
	<div class="mb-2 ml-1 rounded-lg border-l-2 border-secondary-500 bg-surface-100-900 p-3 text-sm">
		<div class="mb-2 flex items-center gap-2 text-secondary-500">
			<IconArrowsSplit size={14} />
			<span class="font-semibold">{m.trace_splice()}</span>
			<code class="text-xs text-surface-600-400">Port {splice.port_number}</code>
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
						Slots {splice.component.slot_start}-{splice.component.slot_end}
					</span>
				{/if}
				{#if splice.component.slot_side}
					<span class="rounded bg-surface-200-800 px-2 py-0.5 text-xs text-surface-600-400">
						Side: {splice.component.slot_side}
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

<!-- Cable Endpoints Details Snippet -->
{#snippet cableEndpointsDetails(endpoints, currentNodeId)}
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
						{endpoints.start_node.name || 'Unknown'}
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
						{endpoints.end_node.name || 'Unknown'}
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
							class="text-surface-600-400 hover:text-primary-500"
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
							class="text-surface-600-400 hover:text-primary-500"
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

<!-- Address Details Snippet -->
{#snippet addressDetails(address)}
	<div class="mb-2 ml-1 rounded-lg border-l-2 border-error-500 bg-surface-100-900 p-3 text-sm">
		<div class="mb-2 flex items-center gap-2 text-error-500">
			<IconMapPin size={14} />
			<span class="font-semibold">{m.form_address({ count: 1 })}</span>
			<button
				type="button"
				class="text-error-500 hover:text-error-400"
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

<!-- Residential Unit Details Snippet -->
{#snippet residentialUnitDetails(ru)}
	<div class="mb-2 ml-1 rounded-lg border-l-2 border-tertiary-500 bg-surface-100-900 p-3 text-sm">
		<div class="mb-2 flex items-center gap-2 text-tertiary-500">
			<IconHome size={14} />
			<span class="font-semibold">{m.section_residential_units({ count: 1 })}</span>
			<button
				type="button"
				class="text-tertiary-500 hover:text-tertiary-400"
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
					class="text-surface-600-400 hover:text-primary-500"
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
