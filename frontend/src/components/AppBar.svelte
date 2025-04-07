<script>
	// Skeleton
	import { AppBar } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import Icon from '@iconify/svelte';

	// Receive the toggle function as a prop
	let { onMenuClick = () => {} } = $props();
</script>

<AppBar>
	{#snippet lead()}
		<button onclick={onMenuClick}>
			<Icon icon="hugeicons:menu-01" width="1.5em" height="1.5em" />
		</button>
	{/snippet}

	{#snippet trail()}
		<button>
			<Icon icon="hugeicons:user-circle" width="1.5em" height="1.5em" />
		</button>
	{/snippet}
	<span>Title</span>
</AppBar>
