<script>
	// Skeleton
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import Icon from '@iconify/svelte';

	let { isSidebarExpanded: expanded = true } = $props();
</script>

<div>
	<!-- Component -->
	<Navigation.Rail {expanded}>
		{#snippet tiles()}
			<Navigation.Tile href="/" labelExpanded="Dashboard" title="Dashboard">
				<Icon icon="hugeicons:dashboard-square-02" width="1.5em" height="1.5em" />
			</Navigation.Tile>
			<Navigation.Tile href="/projects" labelExpanded="Projects" title="Projects">
				<Icon icon="hugeicons:folder-check" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
		{#snippet footer()}
			<Navigation.Tile labelExpanded="Settings" href="/settings" title="Settings">
				<Icon icon="hugeicons:settings-01" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
	</Navigation.Rail>
</div>
