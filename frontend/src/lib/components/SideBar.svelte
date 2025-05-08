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

	import { page } from '$app/state';

	let isSidebarExpanded = $state(true);

	function toggleExpanded() {
		isSidebarExpanded = !isSidebarExpanded;
	}
</script>

<div class="hidden md:block border-r-2 border-surface-200-800">
	<!-- Component -->
	<Navigation.Rail expanded={isSidebarExpanded}>
		{#snippet header()}
			<Navigation.Tile labelExpanded={m.menu()} onclick={toggleExpanded} title="Toggle Menu Width">
				<IconLayoutSidebarLeftCollapse size={28} class="text-surface-700-300" />
			</Navigation.Tile>
		{/snippet}
		{#snippet tiles()}
			<Navigation.Tile
				href="/map"
				labelExpanded={m.map()}
				title="Karte"
				selected={page.url.pathname === '/map'}
			>
				<IconMap2 size={28} class="text-surface-700-300" />
			</Navigation.Tile>
			<Navigation.Tile
				href="/trench"
				labelExpanded={m.trench()}
				title="Trench"
				selected={page.url.pathname === '/trench'}
			>
				<IconVectorSpline size={28} class="text-surface-700-300" />
			</Navigation.Tile>
		{/snippet}
		{#snippet footer()}
			<Navigation.Tile
				href="/settings"
				labelExpanded={m.settings()}
				title="Settings"
				selected={page.url.pathname === '/settings'}
			>
				<IconSettings size={28} class="text-surface-700-300" />
			</Navigation.Tile>
		{/snippet}
	</Navigation.Rail>
</div>
