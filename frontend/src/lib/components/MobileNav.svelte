<script>
	import { quintOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		IconAiGateway,
		IconArrowRightToArc,
		IconBuildings,
		IconChartArcs,
		IconDotsVertical,
		IconFileText,
		IconMapPin,
		IconSettings,
		IconSTurnRight,
		IconTable,
		IconTopologyBus,
		IconTopologyRing3
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { userStore } from '$lib/stores/auth';
	import { canAccessRoute } from '$lib/utils/permissions.js';
	import { tooltip } from '$lib/utils/tooltip.js';

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

	/**
	 * @typedef {Object} NavLink
	 * @property {string} href
	 * @property {() => string} label
	 * @property {any} icon
	 * @property {(path: string) => boolean} pathMatch
	 */

	/** @type {NavLink[]} */
	const allMainLinks = [
		{
			href: '/dashboard',
			label: () => m.nav_dashboard(),
			icon: IconChartArcs,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/dashboard')
		},
		{
			href: '/map',
			label: () => m.nav_map(),
			icon: IconMapPin,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/map')
		}
	];

	/** @type {NavLink[]} */
	const allInfrastructureLinks = [
		{
			href: '/conduit',
			label: () => m.nav_conduit_management(),
			icon: IconTable,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/conduit')
		},
		{
			href: '/trench',
			label: () => m.nav_conduit_connection(),
			icon: IconArrowRightToArc,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/trench')
		},
		{
			href: '/pipe-branch',
			label: () => m.nav_pipe_branch(),
			icon: IconAiGateway,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/pipe-branch')
		},
		{
			href: '/house-connections',
			label: () => m.nav_house_connections(),
			icon: IconTopologyBus,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/house-connections')
		}
	];

	/** @type {NavLink[]} */
	const allCableLinks = [
		{
			href: '/network-schema',
			label: () => m.nav_network_schema(),
			icon: IconTopologyRing3,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/network-schema')
		},
		{
			href: '/trace',
			label: () => m.nav_fiber_trace(),
			icon: IconSTurnRight,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/trace')
		}
	];

	/** @type {NavLink[]} */
	const allAddressLinks = [
		{
			href: '/address',
			label: () => m.nav_address(),
			icon: IconBuildings,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/address')
		}
	];

	/** @type {NavLink[]} */
	const allFooterLinks = [
		{
			href: '/admin/logs',
			label: () => m.nav_logs(),
			icon: IconFileText,
			pathMatch: (/** @type {string} */ path) => path === '/admin/logs'
		},
		{
			href: '/settings',
			label: () => m.nav_settings(),
			icon: IconSettings,
			pathMatch: (/** @type {string} */ path) => path.startsWith('/settings')
		}
	];

	/**
	 * Filters links based on user route permissions.
	 * @param {NavLink[]} links
	 */
	function filterByPermission(links) {
		return links.filter((link) => canAccessRoute($userStore.permissions, link.href));
	}

	const mainLinks = $derived(filterByPermission(allMainLinks));
	const infrastructureLinks = $derived(filterByPermission(allInfrastructureLinks));
	const cableLinks = $derived(filterByPermission(allCableLinks));
	const addressLinks = $derived(filterByPermission(allAddressLinks));
	const footerLinks = $derived(filterByPermission(allFooterLinks));

	const hasMoreContent = $derived(
		infrastructureLinks.length > 0 ||
			cableLinks.length > 0 ||
			addressLinks.length > 0 ||
			footerLinks.length > 0
	);

	let totalTiles = $derived(mainLinks.length + (hasMoreContent ? 1 : 0));

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
			{#each mainLinks as link (link.href)}
				{@const Icon = link.icon}
				{@const isSelected = link.pathMatch(page.url.pathname)}
				<a
					href={link.href}
					class={getAnchorClass(isSelected)}
					aria-label={link.label()}
					{@attach tooltip(link.label())}
				>
					<Icon size={24} class="text-surface-700-300" />
					<span class="text-[10px]">{link.label()}</span>
				</a>
			{/each}

			{#if hasMoreContent}
				<button
					type="button"
					class={getAnchorClass(showMoreMenu)}
					aria-label={m.form_more_sites()}
					{@attach tooltip(m.form_more_sites())}
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
		<div class="p-4 space-y-4">
			<h3 class="text-lg font-semibold text-surface-900-100">{m.form_more_sites()}</h3>

			{#if infrastructureLinks.length > 0}
				<section>
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-700-300 mb-2">
						{m.nav_category_conduit()}
					</h4>
					<div class="space-y-1">
						{#each infrastructureLinks as link (link.href)}
							{@const Icon = link.icon}
							<a
								href={link.href}
								class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100-800 transition-colors"
								onclick={closeMoreMenu}
							>
								<Icon size={20} class="text-surface-700-300" />
								<span class="text-surface-900-100">{link.label()}</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			{#if cableLinks.length > 0}
				<section>
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-700-300 mb-2">
						{m.nav_category_cable()}
					</h4>
					<div class="space-y-1">
						{#each cableLinks as link (link.href)}
							{@const Icon = link.icon}
							<a
								href={link.href}
								class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100-800 transition-colors"
								onclick={closeMoreMenu}
							>
								<Icon size={20} class="text-surface-700-300" />
								<span class="text-surface-900-100">{link.label()}</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			{#if addressLinks.length > 0}
				<section>
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-700-300 mb-2">
						{m.form_building({ count: 2 })}
					</h4>
					<div class="space-y-1">
						{#each addressLinks as link (link.href)}
							{@const Icon = link.icon}
							<a
								href={link.href}
								class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100-800 transition-colors"
								onclick={closeMoreMenu}
							>
								<Icon size={20} class="text-surface-700-300" />
								<span class="text-surface-900-100">{link.label()}</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			{#if footerLinks.length > 0}
				<section>
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-700-300 mb-2">
						{m.nav_category_system()}
					</h4>
					<div class="space-y-1">
						{#each footerLinks as link (link.href)}
							{@const Icon = link.icon}
							<a
								href={link.href}
								class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100-800 transition-colors"
								onclick={closeMoreMenu}
							>
								<Icon size={20} class="text-surface-700-300" />
								<span class="text-surface-900-100">{link.label()}</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
{/if}
