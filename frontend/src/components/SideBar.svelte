<script>
	// Skeleton
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import Icon from '@iconify/svelte';

	let isSidebarExpanded = $state(true);

	function toggleExpanded() {
		isSidebarExpanded = !isSidebarExpanded;
	}
</script>

<div>
	<!-- Component -->
	<Navigation.Rail expanded={isSidebarExpanded}>
		{#snippet header()}
			<Navigation.Tile labelExpanded="Menu" onclick={toggleExpanded} title="Toggle Menu Width">
				<Icon icon="hugeicons:menu-01" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
		{#snippet tiles()}
			<Navigation.Tile href="/" labelExpanded="Dashboard" title="Dashboard">
				<Icon icon="hugeicons:dashboard-square-02" width="1.5em" height="1.5em" />
			</Navigation.Tile>
			<Navigation.Tile href="/projects" labelExpanded="Projects" title="Projects">
				<Icon icon="hugeicons:folder-check" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
		{#snippet footer()}
			<Navigation.Tile labelExpanded="Settings" href="/" title="Settings">
				<Icon icon="hugeicons:settings-01" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
	</Navigation.Rail>
</div>
