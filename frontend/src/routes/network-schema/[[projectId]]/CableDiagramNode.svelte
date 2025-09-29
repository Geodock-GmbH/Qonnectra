<script>
	// Skeleton
	import { createToaster, Toaster } from '@skeletonlabs/skeleton-svelte';

	// Paraglide
	// SvelteFlow
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
