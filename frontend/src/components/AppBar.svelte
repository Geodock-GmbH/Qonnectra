<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import Icon from '@iconify/svelte';
</script>

<div>
	<AppBar>
		{#snippet trail()}
			<button>
				<Icon icon="hugeicons:user-circle" width="1.5em" height="1.5em" />
			</button>
		{/snippet}
		<span>Title</span>
	</AppBar>
</div>
