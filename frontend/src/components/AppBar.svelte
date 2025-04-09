<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Avatar } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import Icon from '@iconify/svelte';
</script>

<div>
	<AppBar>
		{#snippet trail()}
			<button>
				<!-- <Icon icon="hugeicons:user-circle" width="1.5em" height="1.5em" /> -->
				<Avatar name="Rainer Zufall" size="size-8" font="font-bold" />
			</button>
		{/snippet}
		<span>Krit-GIS</span>
	</AppBar>
</div>
