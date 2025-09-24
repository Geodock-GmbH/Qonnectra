<script>
	// Skeleton
	import { createToaster, Toaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// SvelteFlow
	import { Position, Handle } from '@xyflow/svelte';

	// Drawer
	import { drawerStore } from '$lib/stores/drawer';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let { id, data } = $props();

	function handleNodeClick() {
		drawerStore.open({
			title: data.label || 'Node Details',
			props: {
				nodeId: id,
				nodeData: data
			}
		});
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleNodeClick();
		}
	}
</script>

<Toaster {toaster}></Toaster>

<Handle type="target" position={Position.Top} />
<Handle type="target" position={Position.Right} />
<Handle type="target" position={Position.Left} />
<Handle type="target" position={Position.Bottom} />
<div
	class="w-30 h-30 flex items-center justify-center overflow-hidden border border-surface-200-700 rounded-lg shadow-md p-2 cursor-pointer hover:bg-surface-100-800 transition-colors"
	role="button"
	tabindex="0"
	onclick={handleNodeClick}
	onkeydown={handleKeydown}
	aria-label="Open node details for {data.label}"
>
	<p class="text-center break-words w-full">
		{data.label}
	</p>
</div>
