<script>
	import { enhance } from '$app/forms';

	let traceType = $state('fiber');
	let traceId = $state('');
	let includeGeometry = $state(false);
	let result = $state(null);
	let error = $state(null);
	let loading = $state(false);

	function handleSubmit() {
		loading = true;
		error = null;
		result = null;

		return async ({ result: formResult, update }) => {
			loading = false;
			if (formResult.type === 'success' && formResult.data?.success) {
				result = formResult.data.result;
			} else if (formResult.type === 'failure') {
				error = formResult.data?.error || 'Unknown error';
			}
			await update();
		};
	}

	function traceFrom(type, id) {
		traceType = type;
		traceId = id;
	}
</script>

<div class="mx-auto max-w-6xl p-4">
	<h1 class="mb-4 text-2xl font-bold">Fiber Trace (Debug)</h1>

	<form
		method="POST"
		action="?/trace"
		use:enhance={handleSubmit}
		class="mb-6 flex flex-wrap items-end gap-4"
	>
		<div>
			<label for="traceType" class="mb-1 block text-sm font-medium">Trace Type</label>
			<select
				id="traceType"
				bind:value={traceType}
				name="traceType"
				class="input rounded border px-3 py-2"
			>
				<option value="fiber">Fiber</option>
				<option value="cable">Cable</option>
				<option value="node">Node</option>
				<option value="address">Address</option>
				<option value="residential_unit">Residential Unit</option>
			</select>
		</div>

		<div class="flex-1">
			<label for="traceId" class="mb-1 block text-sm font-medium">UUID</label>
			<input
				id="traceId"
				type="text"
				bind:value={traceId}
				name="traceId"
				placeholder="Enter UUID..."
				class="input w-full rounded border px-3 py-2"
			/>
		</div>

		<div class="flex items-center gap-2">
			<input
				type="checkbox"
				id="includeGeometry"
				name="includeGeometry"
				bind:checked={includeGeometry}
				class="h-4 w-4"
			/>
			<label for="includeGeometry" class="text-sm">Include Geometry</label>
		</div>

		<button
			type="submit"
			disabled={loading || !traceId}
			class="btn variant-filled-primary rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
		>
			{loading ? 'Tracing...' : 'Trace'}
		</button>
	</form>

	{#if error}
		<div class="mb-4 rounded border border-red-400 bg-red-100 p-4 text-red-700">
			{error}
		</div>
	{/if}

	{#if result}
		<div class="mb-4 rounded bg-gray-100 p-4">
			<h2 class="mb-2 font-bold">Statistics</h2>
			<div class="grid grid-cols-4 gap-4 text-sm md:grid-cols-8">
				<div>
					<span class="text-gray-600">Fibers:</span>
					<span class="font-mono">{result.statistics.total_fibers}</span>
				</div>
				<div>
					<span class="text-gray-600">Nodes:</span>
					<span class="font-mono">{result.statistics.total_nodes}</span>
				</div>
				<div>
					<span class="text-gray-600">Splices:</span>
					<span class="font-mono">{result.statistics.total_splices}</span>
				</div>
				<div>
					<span class="text-gray-600">Cables:</span>
					<span class="font-mono">{result.statistics.total_cables ?? '-'}</span>
				</div>
				<div>
					<span class="text-gray-600">Trenches:</span>
					<span class="font-mono">{result.statistics.total_trenches ?? '-'}</span>
				</div>
				<div>
					<span class="text-gray-600">Addresses:</span>
					<span class="font-mono">{result.statistics.total_addresses}</span>
				</div>
				<div>
					<span class="text-gray-600">Res. Units:</span>
					<span class="font-mono">{result.statistics.total_residential_units}</span>
				</div>
				<div>
					<span class="text-gray-600">Branches:</span>
					<span class="font-mono">{result.statistics.has_branches ? 'Yes' : 'No'}</span>
				</div>
			</div>
		</div>

		<div class="mb-4">
			<h2 class="mb-2 font-bold">Entry Point</h2>
			<pre class="overflow-x-auto rounded bg-gray-800 p-3 text-sm text-green-400">{JSON.stringify(
					result.entry_point,
					null,
					2
				)}</pre>
		</div>

		<!-- Cable Infrastructure Section -->
		{#if result.cable_infrastructure && Object.keys(result.cable_infrastructure).length > 0}
			<div class="mb-4">
				<h2 class="mb-2 font-bold">Cable Infrastructure</h2>
				<div class="space-y-2">
					{#each Object.entries(result.cable_infrastructure) as [cableId, infra]}
						<details class="rounded border bg-white p-2">
							<summary class="cursor-pointer font-medium">
								Cable {cableId.slice(0, 8)}...
								{#if infra.conduit}
									<span class="ml-2 text-sm text-gray-500">→ {infra.conduit.name}</span>
								{/if}
							</summary>
							<div class="mt-2 space-y-2 pl-4 text-sm">
								{#if infra.microduct}
									<div class="rounded bg-pink-50 p-2">
										<span class="font-medium text-pink-700">Microduct:</span>
										<span class="ml-2">#{infra.microduct.number}</span>
										<span
											class="ml-2 rounded px-1"
											style="background-color: {infra.microduct.color_hex || '#fbcfe8'}"
										>
											{infra.microduct.color}
										</span>
										{#if infra.microduct.status}
											<span class="ml-2 text-gray-500">({infra.microduct.status})</span>
										{/if}
									</div>
								{/if}
								{#if infra.conduit}
									<div class="rounded bg-indigo-50 p-2">
										<span class="font-medium text-indigo-700">Conduit:</span>
										<span class="ml-2">{infra.conduit.name}</span>
										{#if infra.conduit.type}
											<span class="ml-2 rounded bg-indigo-200 px-1">{infra.conduit.type}</span>
										{/if}
									</div>
								{/if}
								{#if infra.trenches && infra.trenches.length > 0}
									<div class="rounded bg-amber-50 p-2">
										<span class="font-medium text-amber-700"
											>Trenches ({infra.trenches.length}):</span
										>
										<div class="mt-1 space-y-1">
											{#each infra.trenches as trench}
												<div
													class="flex flex-wrap items-center gap-2 rounded bg-amber-100 px-2 py-1 text-xs"
												>
													<span class="font-mono">{trench.id_trench}</span>
													{#if trench.construction_type}
														<span class="rounded bg-amber-200 px-1">{trench.construction_type}</span
														>
													{/if}
													{#if trench.surface}
														<span class="text-gray-500">{trench.surface}</span>
													{/if}
													{#if trench.length}
														<span class="text-gray-500">{trench.length.toFixed(1)}m</span>
													{/if}
													{#if trench.geometry}
														<span class="rounded bg-green-200 px-1 text-green-700"
															>Has Geometry</span
														>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</details>
					{/each}
				</div>
			</div>
		{/if}

		<div>
			<h2 class="mb-2 font-bold">Trace Tree</h2>
			{#if result.trace_tree}
				{@render traceNode(result.trace_tree, 0)}
			{:else if result.trace_trees}
				{#each result.trace_trees as tree, i (tree.fiber?.id ?? i)}
					<details class="mb-2" open={i === 0}>
						<summary class="cursor-pointer font-medium">Fiber {i + 1}</summary>
						<div class="ml-4">
							{@render traceNode(tree, 0)}
						</div>
					</details>
				{/each}
			{:else}
				<p class="text-gray-500">No trace data</p>
			{/if}
		</div>

		<details class="mt-6">
			<summary class="cursor-pointer text-gray-600">Raw JSON</summary>
			<pre
				class="mt-2 overflow-x-auto rounded bg-gray-800 p-3 text-sm text-green-400">{JSON.stringify(
					result,
					null,
					2
				)}</pre>
		</details>
	{/if}
</div>

{#snippet traceNode(node, depth)}
	<div class="border-l-2 border-gray-300 py-2 pl-4" style="margin-left: {depth * 20}px">
		<!-- Fiber Info Row -->
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<button
				type="button"
				class="rounded bg-blue-100 px-2 py-0.5 font-mono hover:bg-blue-200"
				onclick={() => traceFrom('fiber', node.fiber.id)}
				title="Trace this fiber"
			>
				F{node.fiber.fiber_number_absolute}
			</button>
			<span class="text-gray-600">in</span>
			<button
				type="button"
				class="rounded bg-green-100 px-2 py-0.5 font-mono hover:bg-green-200"
				onclick={() => traceFrom('cable', node.fiber.cable_id)}
				title="Trace this cable"
			>
				{node.fiber.cable_name}
			</button>
			{#if node.fiber.cable_type}
				<span class="rounded bg-green-200 px-1 text-xs text-green-700">{node.fiber.cable_type}</span
				>
			{/if}
			{#if node.node}
				<span class="text-gray-400">&rarr;</span>
				<button
					type="button"
					class="rounded bg-yellow-100 px-2 py-0.5 font-mono hover:bg-yellow-200"
					onclick={() => traceFrom('node', node.node.id)}
					title="Trace this node"
				>
					{node.node.name}
				</button>
				<span class="text-xs text-gray-400">({node.direction})</span>
			{/if}
		</div>

		<!-- Enhanced Fiber Details -->
		{@render fiberDetails(node.fiber)}

		<!-- Splice Component Info -->
		{#if node.splice}
			{@render spliceDetails(node.splice)}
		{/if}

		<!-- Cable endpoints (start/end nodes) -->
		{#if node.cable_endpoints && (node.cable_endpoints.start_node || node.cable_endpoints.end_node)}
			{@render cableEndpointsDetails(node.cable_endpoints, node.node?.id)}
		{/if}

		<!-- Address details (from node) -->
		{#if node.node?.address}
			{@render addressDetails(node.node.address)}
		{/if}

		<!-- Residential Unit details -->
		{#if node.residential_unit}
			{@render residentialUnitDetails(node.residential_unit)}
		{/if}

		{#if node.children && node.children.length > 0}
			{#each node.children as child (child.fiber.id)}
				{@render traceNode(child, depth + 1)}
			{/each}
		{/if}
	</div>
{/snippet}

{#snippet fiberDetails(fiber)}
	<div class="ml-4 mt-1 flex flex-wrap gap-2 text-xs text-gray-600">
		{#if fiber.bundle_number !== null && fiber.bundle_number !== undefined}
			<span>Bundle: <span class="font-mono">{fiber.bundle_number}</span></span>
		{/if}
		{#if fiber.fiber_number_in_bundle}
			<span>In Bundle: <span class="font-mono">{fiber.fiber_number_in_bundle}</span></span>
		{/if}
		{#if fiber.fiber_color}
			<span class="rounded px-1" style="background-color: {fiber.fiber_color_hex || '#e5e7eb'}">
				{fiber.fiber_color}
			</span>
		{/if}
		{#if fiber.bundle_color}
			<span class="rounded px-1" style="background-color: {fiber.bundle_color_hex || '#e5e7eb'}">
				Bundle: {fiber.bundle_color}
			</span>
		{/if}
		{#if fiber.layer}
			<span>Layer: <span class="font-mono">{fiber.layer}</span></span>
		{/if}
		{#if fiber.status}
			<span class="rounded bg-gray-200 px-1">{fiber.status}</span>
		{/if}
	</div>
{/snippet}

{#snippet spliceDetails(splice)}
	<div class="ml-4 mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-xs">
		<div class="mb-1 flex items-center gap-2">
			<span class="font-semibold text-rose-700">Splice</span>
			<span class="font-mono text-gray-600">Port {splice.port_number}</span>
		</div>
		{#if splice.component}
			<div class="flex flex-wrap gap-2 text-gray-600">
				{#if splice.component.type}
					<span class="rounded bg-rose-200 px-1">{splice.component.type}</span>
				{/if}
				{#if splice.component.slot_start !== null && splice.component.slot_end !== null}
					<span>Slots: {splice.component.slot_start}-{splice.component.slot_end}</span>
				{/if}
				{#if splice.component.slot_side}
					<span>Side: {splice.component.slot_side}</span>
				{/if}
				{#if splice.component.in_or_out}
					<span class="rounded bg-gray-200 px-1">{splice.component.in_or_out}</span>
				{/if}
				{#if splice.component.structure_port}
					<span>Port: {splice.component.structure_port}</span>
				{/if}
			</div>
		{/if}
		{#if splice.container_path && splice.container_path.length > 0}
			<div class="mt-1 border-t border-rose-200 pt-1">
				<span class="text-gray-500">Container Path:</span>
				<span class="ml-1">
					{#each splice.container_path as container, i}
						{#if i > 0}<span class="mx-1 text-gray-400">&rarr;</span>{/if}
						<span class="rounded bg-rose-100 px-1">
							{container.type}{#if container.name}: {container.name}{/if}
						</span>
					{/each}
				</span>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet cableEndpointsDetails(endpoints, currentNodeId)}
	<div class="ml-4 mt-2 rounded border border-cyan-200 bg-cyan-50 p-2 text-xs">
		<div class="mb-1 font-semibold text-cyan-700">Cable Path: {endpoints.cable_name}</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if endpoints.start_node}
				<div class="flex items-center gap-1">
					<span class="text-gray-500">Start:</span>
					<button
						type="button"
						class="rounded px-1.5 py-0.5 font-mono hover:bg-cyan-200"
						class:bg-cyan-200={endpoints.start_node.id === currentNodeId}
						class:bg-cyan-100={endpoints.start_node.id !== currentNodeId}
						onclick={() => traceFrom('node', endpoints.start_node.id)}
						title="Trace from start node"
					>
						{endpoints.start_node.name || 'Unknown'}
					</button>
					{#if endpoints.start_node.type}
						<span class="rounded bg-gray-200 px-1 text-gray-600">{endpoints.start_node.type}</span>
					{/if}
				</div>
			{:else}
				<span class="text-gray-400">Start: Not set</span>
			{/if}

			<span class="text-gray-400">&harr;</span>

			{#if endpoints.end_node}
				<div class="flex items-center gap-1">
					<span class="text-gray-500">End:</span>
					<button
						type="button"
						class="rounded px-1.5 py-0.5 font-mono hover:bg-cyan-200"
						class:bg-cyan-200={endpoints.end_node.id === currentNodeId}
						class:bg-cyan-100={endpoints.end_node.id !== currentNodeId}
						onclick={() => traceFrom('node', endpoints.end_node.id)}
						title="Trace from end node"
					>
						{endpoints.end_node.name || 'Unknown'}
					</button>
					{#if endpoints.end_node.type}
						<span class="rounded bg-gray-200 px-1 text-gray-600">{endpoints.end_node.type}</span>
					{/if}
				</div>
			{:else}
				<span class="text-gray-400">End: Not set</span>
			{/if}
		</div>

		<!-- Endpoint addresses -->
		{#if endpoints.start_node?.address || endpoints.end_node?.address}
			<div class="mt-1 border-t border-cyan-200 pt-1 text-gray-500">
				{#if endpoints.start_node?.address}
					<div>
						<span class="text-gray-400">Start @:</span>
						<button
							type="button"
							class="hover:text-cyan-700 hover:underline"
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
						<span class="text-gray-400">End @:</span>
						<button
							type="button"
							class="hover:text-cyan-700 hover:underline"
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

{#snippet addressDetails(address)}
	<div class="ml-4 mt-2 rounded border border-orange-200 bg-orange-50 p-2 text-xs">
		<div class="mb-1 flex items-center gap-2">
			<span class="font-semibold text-orange-700">Address</span>
			<button
				type="button"
				class="text-orange-600 hover:text-orange-800 hover:underline"
				onclick={() => traceFrom('address', address.id)}
				title="Trace this address"
			>
				{address.street}
				{address.housenumber}{address.suffix || ''}, {address.zip_code}
				{address.city}
			</button>
		</div>
		<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 md:grid-cols-4">
			{#if address.id_address}
				<div><span class="text-gray-400">ID:</span> {address.id_address}</div>
			{/if}
			{#if address.district}
				<div><span class="text-gray-400">District:</span> {address.district}</div>
			{/if}
			{#if address.status_development}
				<div><span class="text-gray-400">Status:</span> {address.status_development}</div>
			{/if}
			{#if address.project}
				<div><span class="text-gray-400">Project:</span> {address.project}</div>
			{/if}
			{#if address.flag}
				<div><span class="text-gray-400">Flag:</span> {address.flag}</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet residentialUnitDetails(ru)}
	<div class="ml-4 mt-2 rounded border border-purple-200 bg-purple-50 p-2 text-xs">
		<div class="mb-1 flex items-center gap-2">
			<span class="font-semibold text-purple-700">Residential Unit</span>
			<button
				type="button"
				class="text-purple-600 hover:text-purple-800 hover:underline"
				onclick={() => traceFrom('residential_unit', ru.id)}
				title="Trace this residential unit"
			>
				{ru.id_residential_unit || ru.id}
			</button>
		</div>
		<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 md:grid-cols-4">
			{#if ru.floor !== null && ru.floor !== undefined}
				<div><span class="text-gray-400">Floor:</span> {ru.floor}</div>
			{/if}
			{#if ru.side}
				<div><span class="text-gray-400">Side:</span> {ru.side}</div>
			{/if}
			{#if ru.building_section}
				<div><span class="text-gray-400">Section:</span> {ru.building_section}</div>
			{/if}
			{#if ru.type}
				<div><span class="text-gray-400">Type:</span> {ru.type}</div>
			{/if}
			{#if ru.status}
				<div><span class="text-gray-400">Status:</span> {ru.status}</div>
			{/if}
			{#if ru.resident_name}
				<div><span class="text-gray-400">Resident:</span> {ru.resident_name}</div>
			{/if}
			{#if ru.ready_for_service}
				<div><span class="text-gray-400">Ready:</span> {ru.ready_for_service}</div>
			{/if}
			{#if ru.external_id_1}
				<div><span class="text-gray-400">Ext ID 1:</span> {ru.external_id_1}</div>
			{/if}
			{#if ru.external_id_2}
				<div><span class="text-gray-400">Ext ID 2:</span> {ru.external_id_2}</div>
			{/if}
		</div>
		<!-- RU's parent address -->
		{#if ru.address}
			<div class="mt-2 border-t border-purple-200 pt-1 text-gray-500">
				<span class="text-gray-400">@ Address:</span>
				<button
					type="button"
					class="hover:text-purple-700 hover:underline"
					onclick={() => traceFrom('address', ru.address.id)}
				>
					{ru.address.street}
					{ru.address.housenumber}{ru.address.suffix || ''}, {ru.address.zip_code}
					{ru.address.city}
				</button>
			</div>
		{/if}
	</div>
{/snippet}
