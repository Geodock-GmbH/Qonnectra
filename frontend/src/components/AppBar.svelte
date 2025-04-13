<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
</script>

<div>
	<AppBar>
		{#snippet trail()}
			<a href="/login">
				<button>
					<Avatar name="Rainer Zufall" size="size-8" font="font-bold"/>
				</button>
			</a>
		{/snippet}
		<span>Krit-GIS</span>
	</AppBar>
</div>
