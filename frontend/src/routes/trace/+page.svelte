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
</script>

<div class="mx-auto max-w-6xl p-4">
	<h1 class="mb-4 text-2xl font-bold">Fiber Trace (Debug)</h1>

	<form method="POST" action="?/trace" use:enhance={handleSubmit} class="mb-6 flex items-end gap-4">
		<div>
			<label class="mb-1 block text-sm font-medium">Trace Type</label>
			<select bind:value={traceType} name="traceType" class="input rounded border px-3 py-2">
				<option value="fiber">Fiber</option>
				<option value="cable">Cable</option>
				<option value="node">Node</option>
			</select>
		</div>

		<div class="flex-1">
			<label class="mb-1 block text-sm font-medium">UUID</label>
			<input
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
			<div class="grid grid-cols-4 gap-4 text-sm">
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
					<span class="text-gray-600">Has Branches:</span>
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
				{#each result.trace_trees as tree, i}
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
		<div class="flex items-center gap-2 text-sm">
			<span class="rounded bg-blue-100 px-2 py-0.5 font-mono">
				F{node.fiber.fiber_number}
			</span>
			<span class="text-gray-600">in</span>
			<span class="rounded bg-green-100 px-2 py-0.5 font-mono">
				{node.fiber.cable_name}
			</span>
			{#if node.node}
				<span class="text-gray-400">&rarr;</span>
				<span class="rounded bg-yellow-100 px-2 py-0.5 font-mono">
					{node.node.name}
				</span>
				<span class="text-xs text-gray-400">({node.direction})</span>
			{/if}
		</div>

		{#if node.children && node.children.length > 0}
			{#each node.children as child}
				{@render traceNode(child, depth + 1)}
			{/each}
		{/if}
	</div>
{/snippet}
