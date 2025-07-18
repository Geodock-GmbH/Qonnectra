<script>
	// Skeleton
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import { IconArrowBarToRight, IconMap2, IconSettings, IconTextPlus } from '@tabler/icons-svelte';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { page } from '$app/state';
	import { sidebarExpanded } from '$lib/stores/store';
</script>

<!-- SideBar -->
<div class="hidden md:block border-r-2 border-surface-200-800">
	<!-- Component -->
	<Navigation.Rail expanded={$sidebarExpanded}>
		{#snippet header()}
			<!-- TODO: Add Logo and Title -->
			<div class="flex items-center gap-2">
				<img src="/favicon.png" alt="Logo" class="w-12 h12" />
				{#if $sidebarExpanded}
					<h1 class="text-2xl font-bold">Title</h1>
				{/if}
			</div>
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
				labelExpanded={m.conduit_connection()}
				title="Trench"
				selected={page.url.pathname.startsWith('/trench')}
			>
				<IconTextPlus size={28} class="text-surface-700-300" />
			</Navigation.Tile>
			<Navigation.Tile
				href="/conduit"
				labelExpanded={m.conduit_management()}
				title="Conduit"
				selected={page.url.pathname.startsWith('/conduit')}
			>
				<IconArrowBarToRight size={28} class="text-surface-700-300" />
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
