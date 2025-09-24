<script>
	import { drawerStore } from '$lib/stores/drawer';

	// Get drawer props to access node data
	let drawerData = $state();
	let { nodeData, nodeId } = $props();
</script>

<div class="card bg-surface-100-900 p-4 space-y-4 shadow-xl">
	<h1 class="text-lg font-semibold">Node Details</h1>

	{#if nodeData}
		<div class="space-y-3">
			<div>
				<h3 class="text-sm font-medium text-surface-600-400">Node ID</h3>
				<p class="text-sm">{nodeId}</p>
			</div>

			<div>
				<h3 class="text-sm font-medium text-surface-600-400">Label</h3>
				<p class="text-sm">{nodeData.label}</p>
			</div>

			{#if nodeData.type}
				<div>
					<h3 class="text-sm font-medium text-surface-600-400">Type</h3>
					<p class="text-sm">{nodeData.type}</p>
				</div>
			{/if}

			{#if nodeData.nodeType}
				<div>
					<h3 class="text-sm font-medium text-surface-600-400">Node Type</h3>
					<p class="text-sm">{nodeData.nodeType}</p>
				</div>
			{/if}

			{#if nodeData.status}
				<div>
					<h3 class="text-sm font-medium text-surface-600-400">Status</h3>
					<p class="text-sm">{nodeData.status}</p>
				</div>
			{/if}

			{#if nodeData.networkLevel}
				<div>
					<h3 class="text-sm font-medium text-surface-600-400">Network Level</h3>
					<p class="text-sm">{nodeData.networkLevel}</p>
				</div>
			{/if}

			{#if nodeData.owner}
				<div>
					<h3 class="text-sm font-medium text-surface-600-400">Owner</h3>
					<p class="text-sm">{nodeData.owner}</p>
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-surface-600-400">No node data available</p>
	{/if}
</div>
