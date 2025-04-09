<script>
	// Skeleton
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import {
		IconLayoutSidebarLeftCollapse,
		IconLayoutSidebarLeftExpand,
		IconMap2,
		IconVectorSpline,
		IconSettings
	} from '@tabler/icons-svelte';

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
				{#if isSidebarExpanded}
					<IconLayoutSidebarLeftCollapse size={36} />
				{:else}
					<IconLayoutSidebarLeftExpand size={36} />
				{/if}
			</Navigation.Tile>
		{/snippet}
		{#snippet tiles()}
			<Navigation.Tile href="/" labelExpanded={m.map()} title="Karte">
				<IconMap2 size={36} />
			</Navigation.Tile>
			<Navigation.Tile href="/trench" labelExpanded={m.trench()} title="Trench">
				<IconVectorSpline size={36} />
			</Navigation.Tile>
		{/snippet}
		{#snippet footer()}
			<Navigation.Tile href="/settings" labelExpanded={m.settings()} title="Settings">
				<IconSettings size={36} />
			</Navigation.Tile>
		{/snippet}
	</Navigation.Rail>
</div>
