<script>
	// Skeleton
	import { Navigation } from '@skeletonlabs/skeleton-svelte';

	// Icons
	import {
		IconAffiliate,
		IconArrowBarToRight,
		IconDashboard,
		IconDotsVertical,
		IconMap2,
		IconSettings,
		IconTextPlus,
		IconTopologyRing2
	} from '@tabler/icons-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { page } from '$app/state';
	import { quintOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';

	// State for more menu
	let showMoreMenu = $state(false);

	// Function to close more menu
	function closeMoreMenu() {
		showMoreMenu = false;
	}

	// Function to toggle more menu
	function toggleMoreMenu() {
		showMoreMenu = !showMoreMenu;
	}

	// Additional navigation items
	const additionalNavItems = [
		// Add more navigation items here when needed
		{ href: '/trench', label: m.nav_conduit_connection(), icon: IconTextPlus },
		{ href: '/conduit', label: m.nav_conduit_management(), icon: IconArrowBarToRight },
		{ href: '/pipe-branch', label: m.nav_pipe_branch(), icon: IconAffiliate },
		{ href: '/network-schema', label: m.nav_network_schema(), icon: IconTopologyRing2 },
		{ href: '/settings', label: m.nav_settings(), icon: IconSettings }
	];

	// Calculate total number of navigation tiles (main tiles + more button if needed)
	let totalTiles = $derived(4 + (additionalNavItems.length > 0 ? 1 : 0));
</script>

<!-- Mobile Navigation Bar -->
<div
	class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-50-900 border-t-2 border-surface-200-800"
	style="--nav-tiles: {totalTiles}"
>
	<Navigation.Bar>
		<Navigation.Tile
			href="/map"
			label={m.nav_map()}
			title={m.nav_map()}
			selected={page.url.pathname === '/map'}
		>
			<IconMap2 size={24} class="text-surface-700-300" />
		</Navigation.Tile>
		<Navigation.Tile
			href="/dashboard"
			label={m.nav_dashboard()}
			title={m.nav_dashboard()}
			selected={page.url.pathname.startsWith('/dashboard')}
		>
			<IconDashboard size={24} class="text-surface-700-300" />
		</Navigation.Tile>
		<!-- More button - only show if there are additional nav items -->
		{#if additionalNavItems.length > 0}
			<Navigation.Tile
				label={m.common_more()}
				title={m.form_more_sites()}
				selected={showMoreMenu}
				onclick={toggleMoreMenu}
			>
				<IconDotsVertical size={24} class="text-surface-700-300" />
			</Navigation.Tile>
		{/if}
	</Navigation.Bar>
</div>

<!-- More Menu Popup -->
{#if showMoreMenu}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-40 md:hidden"
		role="button"
		tabindex="0"
		onclick={closeMoreMenu}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				closeMoreMenu();
			}
		}}
	></div>

	<!-- Popup Menu -->
	<div
		class="fixed bottom-20 left-4 right-4 z-50 bg-surface-200-800 rounded-t-lg border-2 border-surface-200-800 shadow-lg md:hidden"
		in:slide={{ duration: 200, easing: quintOut }}
	>
		<div class="p-4">
			<h3 class="text-lg font-semibold mb-3 text-surface-900-100">{m.form_more_sites()}</h3>
			{#if additionalNavItems.length > 0}
				<div class="space-y-2">
					{#each additionalNavItems as item}
						<a
							href={item.href}
							class="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-100-800 transition-colors"
							onclick={closeMoreMenu}
						>
							<item.icon size={20} class="text-surface-700-300" />
							<span class="text-surface-900-100">{item.label}</span>
						</a>
					{/each}
				</div>
			{:else}
				<p class="text-surface-600-400 text-sm">No additional options available</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Dynamic tile sizing based on number of tiles */
	:global(.navigation-bar) {
		display: grid;
		grid-template-columns: repeat(var(--nav-tiles, 4), 1fr);
	}

	:global(.navigation-tile) {
		min-width: 0;
		flex: 1;
	}
</style>
