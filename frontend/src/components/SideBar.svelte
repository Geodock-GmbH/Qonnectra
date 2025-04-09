<script>
	// Skeleton
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import Icon from '@iconify/svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	let isSidebarExpanded = $state(true);

	function toggleExpanded() {
		isSidebarExpanded = !isSidebarExpanded;
	}

</script>

<div>
	<!-- Component -->
	<Navigation.Rail expanded={isSidebarExpanded}>
		{#snippet header()}
			<Navigation.Tile labelExpanded={m.menu()} onclick={toggleExpanded} title="Toggle Menu Width">
				<Icon icon="hugeicons:menu-01" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
		{#snippet tiles()}
			<Navigation.Tile href="/" labelExpanded={m.map()} title="Karte">
				<Icon icon="hugeicons:maps-location-01" width="1.5em" height="1.5em" />
			</Navigation.Tile>
			<Navigation.Tile href="/trench" labelExpanded={m.trench()} title="Trench">
				<Icon icon="hugeicons:arrange" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
		{#snippet footer()}
			<Navigation.Tile labelExpanded={m.settings()} href="/" title="Settings">
				<Icon icon="hugeicons:settings-01" width="1.5em" height="1.5em" />
			</Navigation.Tile>
		{/snippet}
	</Navigation.Rail>
</div>
