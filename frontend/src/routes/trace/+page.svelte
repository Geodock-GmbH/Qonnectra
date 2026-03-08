<script>
	import { enhance } from '$app/forms';

	let traceType = $state('fiber');
	let traceId = $state('');
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

	<form method="POST" action="?/trace" use:enhance={handleSubmit} class="mb-6 flex items-end gap-4">
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
			<div class="grid grid-cols-3 gap-4 text-sm md:grid-cols-6">
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
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<button
				type="button"
				class="rounded bg-blue-100 px-2 py-0.5 font-mono hover:bg-blue-200"
				onclick={() => traceFrom('fiber', node.fiber.id)}
				title="Trace this fiber"
			>
				F{node.fiber.fiber_number}
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
				{address.street} {address.housenumber}{address.suffix || ''}, {address.zip_code}
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
					{ru.address.street} {ru.address.housenumber}{ru.address.suffix || ''}, {ru.address
						.zip_code}
					{ru.address.city}
				</button>
			</div>
		{/if}
	</div>
{/snippet}
