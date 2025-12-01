<script>
	import { quintOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		IconAffiliate,
		IconArrowBarToRight,
		IconDashboard,
		IconDotsVertical,
		IconFileText,
		IconHome2,
		IconMap2,
		IconSettings,
		IconTextPlus,
		IconTopologyRing2
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let showMoreMenu = $state(false);

	/**
	 * Close more menu
	 */
	function closeMoreMenu() {
		showMoreMenu = false;
	}

	/**
	 * Toggle more menu
	 */
	function toggleMoreMenu() {
		showMoreMenu = !showMoreMenu;
	}

	const mainNavItems = [
		{
			href: '/map',
			label: () => m.nav_map(),
			icon: IconMap2,
			pathMatch: (path) => path.startsWith('/map')
		},
		{
			href: '/dashboard',
			label: () => m.nav_dashboard(),
			icon: IconDashboard,
			pathMatch: (path) => path.startsWith('/dashboard')
		}
	];

	const additionalNavItems = [
		{ href: '/conduit', label: m.nav_conduit_management(), icon: IconArrowBarToRight },
		{ href: '/trench', label: m.nav_conduit_connection(), icon: IconTextPlus },
		{ href: '/pipe-branch', label: m.nav_pipe_branch(), icon: IconAffiliate },
		{ href: '/house-connections', label: m.nav_house_connections(), icon: IconHome2 },
		{ href: '/network-schema', label: m.nav_network_schema(), icon: IconTopologyRing2 },
		{ href: '/admin/logs', label: m.nav_logs(), icon: IconFileText },
		{ href: '/settings', label: m.nav_settings(), icon: IconSettings }
	];

	let totalTiles = $derived(mainNavItems.length + (additionalNavItems.length > 0 ? 1 : 0));

	/**
	 * Get anchor class based on selection
	 * @param {boolean} isSelected - Whether the item is selected
	 * @returns {string} - The anchor class
	 */
	function getAnchorClass(isSelected) {
		const baseClass = 'btn hover:preset-tonal flex-col items-center gap-1';
		return isSelected ? `${baseClass} preset-filled` : baseClass;
	}
</script>

<!-- Mobile Navigation Bar -->
<div
	class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-50-900 border-t-2 border-surface-200-800"
>
	<Navigation layout="bar">
		<Navigation.Menu class="grid gap-2" style="grid-template-columns: repeat({totalTiles}, 1fr);">
			{#each mainNavItems as item}
				{@const Icon = item.icon}
				{@const isSelected = item.pathMatch(page.url.pathname)}
				<a href={item.href} class={getAnchorClass(isSelected)} title={item.label()}>
					<Icon size={24} class="text-surface-700-300" />
					<span class="text-[10px]">{item.label()}</span>
				</a>
			{/each}
			<!-- More button -->
			{#if additionalNavItems.length > 0}
				<button
					type="button"
					class={getAnchorClass(showMoreMenu)}
					title={m.form_more_sites()}
					onclick={toggleMoreMenu}
				>
					<IconDotsVertical size={24} class="text-surface-700-300" />
					<span class="text-[10px]">{m.common_more()}</span>
				</button>
			{/if}
		</Navigation.Menu>
	</Navigation>
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
