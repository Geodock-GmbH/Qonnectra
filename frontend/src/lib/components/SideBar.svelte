<script>
	// Skeleton
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import {
		IconAffiliate,
		IconArrowBarToRight,
		IconDashboard,
		IconMap2,
		IconSettings,
		IconTextPlus,
		IconTopologyRing2
	} from '@tabler/icons-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { page } from '$app/state';
	import { sidebarExpanded } from '$lib/stores/store';
	import AppIcon from './AppIcon.svelte';
</script>

<!-- SideBar -->
<div class="hidden md:block border-r-2 border-surface-200-800">
	<!-- Component -->
	<Navigation.Rail expanded={$sidebarExpanded}>
		{#snippet header()}
			<div class="flex items-center gap-2">
				{#if $sidebarExpanded}
					<AppIcon size="2rem" />
					<h1 class="text-2xl font-semibold">Qonnectra</h1>
				{:else}
					<AppIcon />
				{/if}
			</div>
		{/snippet}
		{#snippet tiles()}
			<Navigation.Tile
				href="/dashboard"
				labelExpanded={m.nav_dashboard()}
				title={m.nav_dashboard()}
				selected={page.url.pathname.startsWith('/dashboard')}
			>
				<IconDashboard size={28} class="text-surface-700-300" />
			</Navigation.Tile>
			<Navigation.Tile
				href="/map"
				labelExpanded={m.nav_map()}
				title={m.nav_map()}
				selected={page.url.pathname === '/map'}
			>
				<IconMap2 size={28} class="text-surface-700-300" />
			</Navigation.Tile>
			<Navigation.Tile
				href="/trench"
				labelExpanded={m.nav_conduit_connection()}
				title={m.nav_conduit_connection()}
				selected={page.url.pathname.startsWith('/trench')}
			>
				<IconTextPlus size={28} class="text-surface-700-300" />
			</Navigation.Tile>
			<Navigation.Tile
				href="/conduit"
				labelExpanded={m.nav_conduit_management()}
				title={m.nav_conduit_management()}
				selected={page.url.pathname.startsWith('/conduit')}
			>
				<IconArrowBarToRight size={28} class="text-surface-700-300" />
			</Navigation.Tile>
			<Navigation.Tile
				href="/pipe-branch"
				labelExpanded={m.nav_pipe_branch()}
				title={m.nav_pipe_branch()}
				selected={page.url.pathname.startsWith('/pipe-branch')}
			>
				<IconAffiliate size={28} class="text-surface-700-300" />
			</Navigation.Tile>
			<Navigation.Tile
				href="/network-schema"
				labelExpanded={m.nav_network_schema()}
				title={m.nav_network_schema()}
				selected={page.url.pathname.startsWith('/network-schema')}
			>
				<IconTopologyRing2 size={28} class="text-surface-700-300" />
			</Navigation.Tile>
		{/snippet}
		{#snippet footer()}
			<Navigation.Tile
				href="/settings"
				labelExpanded={m.nav_settings()}
				title={m.nav_settings()}
				selected={page.url.pathname === '/settings'}
			>
				<IconSettings size={28} class="text-surface-700-300" />
			</Navigation.Tile>
		{/snippet}
	</Navigation.Rail>
</div>
