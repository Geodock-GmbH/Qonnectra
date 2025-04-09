<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
</script>

<div>
	<AppBar>
		{#snippet trail()}
			<button>
				<Avatar name="Rainer Zufall" size="size-8" font="font-bold" />
			</button>
		{/snippet}
		<span>Krit-GIS</span>
	</AppBar>
</div>
