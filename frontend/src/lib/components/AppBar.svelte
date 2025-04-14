<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
</script>

<div>
	<AppBar>
		{#snippet trail()}
			<a href="/login">
				<button class="btn bg-transparent">
					<Avatar name="Rainer Zufall" size="size-8" font="font-bold"/>
				</button>
			</a>
		{/snippet}
		<span class="font-bold">Krit-GIS</span>
	</AppBar>
</div>
