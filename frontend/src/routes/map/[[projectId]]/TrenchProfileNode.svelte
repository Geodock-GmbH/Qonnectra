<script>
	import { NodeResizer } from '@xyflow/svelte';

	import { tooltip } from '$lib/utils/tooltip.js';

	let { data, selected } = $props();

	const tooltipContent = $derived(
		`${data?.conduit?.conduit_name || 'Unknown'} - ${data?.conduit?.conduit_type || 'No type'}`
	);
</script>

<NodeResizer minWidth={40} minHeight={40} maxWidth={200} maxHeight={200} isVisible={selected} />

<div
	class="trench-profile-node"
	class:selected
	{@attach tooltip(tooltipContent, { position: 'top', delay: 300 })}
>
	<div class="node-inner">
		<span class="node-label">{data?.conduit?.conduit_name || ''}</span>
	</div>
</div>

<style>
	.trench-profile-node {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: linear-gradient(
			145deg,
			var(--color-surface-200) 0%,
			var(--color-surface-300) 50%,
			var(--color-surface-400) 100%
		);
		border: 3px solid var(--color-surface-500);
		box-shadow:
			inset 2px 2px 4px rgba(255, 255, 255, 0.3),
			inset -2px -2px 4px rgba(0, 0, 0, 0.2),
			2px 2px 8px rgba(0, 0, 0, 0.2);
		cursor: grab;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}

	.trench-profile-node:hover {
		border-color: var(--color-primary-400);
	}

	.trench-profile-node.selected {
		border-color: var(--color-primary-500);
		box-shadow:
			inset 2px 2px 4px rgba(255, 255, 255, 0.3),
			inset -2px -2px 4px rgba(0, 0, 0, 0.2),
			0 0 0 2px var(--color-primary-500),
			2px 2px 8px rgba(0, 0, 0, 0.2);
	}

	.node-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 4px;
		overflow: hidden;
	}

	.node-label {
		font-size: 10px;
		font-weight: 500;
		text-align: center;
		color: var(--color-surface-900);
		word-break: break-word;
		line-height: 1.2;
		max-height: 100%;
		overflow: hidden;
	}
</style>
