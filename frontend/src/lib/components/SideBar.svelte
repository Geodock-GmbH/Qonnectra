<script>
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		IconAddressBook,
		IconAffiliate,
		IconArrowBarToRight,
		IconChartArcs,
		IconFileText,
		IconHome2,
		IconMap2,
		IconNetwork,
		IconSettings,
		IconTextPlus,
		IconTopologyRing2
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { userStore } from '$lib/stores/auth';
	import { sidebarExpanded } from '$lib/stores/store';
	import { canAccessRoute } from '$lib/utils/permissions.js';
	import { tooltip } from '$lib/utils/tooltip.js';

	import AppIcon from './AppIcon.svelte';

	const allMainLinks = [
		{
			href: '/dashboard',
			label: () => m.nav_dashboard(),
			icon: IconChartArcs,
			pathMatch: (path) => path.startsWith('/dashboard')
		},
		{
			href: '/map',
			label: () => m.nav_map(),
			icon: IconMap2,
			pathMatch: (path) => path.startsWith('/map')
		}
	];

	const allInfrastructureLinks = [
		{
			href: '/conduit',
			label: () => m.nav_conduit_management(),
			icon: IconTextPlus,
			pathMatch: (path) => path.startsWith('/conduit')
		},
		{
			href: '/trench',
			label: () => m.nav_conduit_connection(),
			icon: IconArrowBarToRight,
			pathMatch: (path) => path.startsWith('/trench')
		},
		{
			href: '/pipe-branch',
			label: () => m.nav_pipe_branch(),
			icon: IconAffiliate,
			pathMatch: (path) => path.startsWith('/pipe-branch')
		},
		{
			href: '/house-connections',
			label: () => m.nav_house_connections(),
			icon: IconHome2,
			pathMatch: (path) => path.startsWith('/house-connections')
		},
		{
			href: '/network-schema',
			label: () => m.nav_network_schema(),
			icon: IconTopologyRing2,
			pathMatch: (path) => path.startsWith('/network-schema')
		},
		{
			href: '/trace',
			label: () => m.nav_fiber_trace(),
			icon: IconNetwork,
			pathMatch: (path) => path.startsWith('/trace')
		}
	];

	const allAddressLinks = [
		{
			href: '/address',
			label: () => m.nav_address(),
			icon: IconAddressBook,
			pathMatch: (path) => path.startsWith('/address')
		}
	];

	const allFooterLinks = [
		{
			href: '/admin/logs',
			label: () => m.nav_logs(),
			icon: IconFileText,
			pathMatch: (path) => path === '/admin/logs'
		},
		{
			href: '/settings',
			label: () => m.nav_settings(),
			icon: IconSettings,
			pathMatch: (path) => path.startsWith('/settings')
		}
	];

	/**
	 * Filters links based on user route permissions.
	 * @param {Array} links
	 */
	function filterByPermission(links) {
		return links.filter((link) => canAccessRoute($userStore.permissions, link.href));
	}

	const mainLinks = $derived(filterByPermission(allMainLinks));
	const infrastructureLinks = $derived(filterByPermission(allInfrastructureLinks));
	const addressLinks = $derived(filterByPermission(allAddressLinks));
	const footerLinks = $derived(filterByPermission(allFooterLinks));

	const allContentLinks = $derived([...mainLinks, ...infrastructureLinks, ...addressLinks]);

	function getAnchorClass(isSelected) {
		const justifyClass = $sidebarExpanded ? 'justify-start' : 'justify-center';
		const paddingClass = $sidebarExpanded ? 'px-2' : 'px-2 py-3';
		const baseClass = `btn hover:preset-tonal ${justifyClass} ${paddingClass} w-full`;
		return isSelected ? `${baseClass} preset-filled` : baseClass;
	}
</script>

<!-- SideBar -->
<div class="hidden md:block border-r-2 border-surface-200-800">
	<!-- Component -->
	<Navigation
		layout={$sidebarExpanded ? 'sidebar' : 'rail'}
		class="grid grid-rows-[auto_1fr_auto] gap-4"
	>
		<Navigation.Header>
			<div class="flex items-center gap-2 {$sidebarExpanded ? 'p-2' : 'p-4 justify-center'}">
				{#if $sidebarExpanded}
					<AppIcon size="1.75rem" />
					<h1 class="text-2xl font-semibold">Qonnectra</h1>
				{:else}
					<AppIcon />
				{/if}
			</div>
		</Navigation.Header>
		<Navigation.Content>
			{#if $sidebarExpanded}
				<!-- Expanded: Show grouped navigation with labels -->
				{#if mainLinks.length > 0}
					<Navigation.Group>
						<Navigation.Label class="text-surface-900-100">{m.nav_category_main()}</Navigation.Label
						>
						<Navigation.Menu>
							{#each mainLinks as link}
								{@const Icon = link.icon}
								{@const isSelected = link.pathMatch(page.url.pathname)}
								<a
									href={link.href}
									class={getAnchorClass(isSelected)}
									aria-label={link.label()}
									{@attach tooltip(link.label())}
								>
									<Icon size={28} class="text-surface-700-300" />
									<span>{link.label()}</span>
								</a>
							{/each}
						</Navigation.Menu>
					</Navigation.Group>
				{/if}

				{#if infrastructureLinks.length > 0}
					<Navigation.Group>
						<Navigation.Label class="text-surface-900-100"
							>{m.nav_category_infrastructure()}</Navigation.Label
						>
						<Navigation.Menu>
							{#each infrastructureLinks as link}
								{@const Icon = link.icon}
								{@const isSelected = link.pathMatch(page.url.pathname)}
								<a
									href={link.href}
									class={getAnchorClass(isSelected)}
									aria-label={link.label()}
									{@attach tooltip(link.label())}
								>
									<Icon size={28} class="text-surface-700-300" />
									<span>{link.label()}</span>
								</a>
							{/each}
						</Navigation.Menu>
					</Navigation.Group>
				{/if}

				{#if addressLinks.length > 0}
					<Navigation.Group>
						<Navigation.Label>{m.form_building({ count: 2 })}</Navigation.Label>
						<Navigation.Menu>
							{#each addressLinks as link}
								{@const Icon = link.icon}
								{@const isSelected = link.pathMatch(page.url.pathname)}
								<a
									href={link.href}
									class={getAnchorClass(isSelected)}
									aria-label={link.label()}
									{@attach tooltip(link.label())}
								>
									<Icon size={28} class="text-surface-700-300" />
									<span>{link.label()}</span>
								</a>
							{/each}
						</Navigation.Menu>
					</Navigation.Group>
				{/if}
			{:else}
				<!-- Collapsed: Single flat list of icons -->
				<Navigation.Group>
					<Navigation.Menu>
						{#each allContentLinks as link}
							{@const Icon = link.icon}
							{@const isSelected = link.pathMatch(page.url.pathname)}
							<a
								href={link.href}
								class={getAnchorClass(isSelected)}
								aria-label={link.label()}
								{@attach tooltip(link.label())}
							>
								<Icon size={28} class="text-surface-700-300" />
							</a>
						{/each}
					</Navigation.Menu>
				</Navigation.Group>
			{/if}
		</Navigation.Content>
		{#if footerLinks.length > 0}
			<Navigation.Footer>
				<Navigation.Group>
					{#if $sidebarExpanded}
						<Navigation.Label>{m.nav_category_system()}</Navigation.Label>
					{/if}
					<Navigation.Menu>
						{#each footerLinks as link}
							{@const Icon = link.icon}
							{@const isSelected = link.pathMatch(page.url.pathname)}
							<a
								href={link.href}
								class={getAnchorClass(isSelected)}
								aria-label={link.label()}
								{@attach tooltip(link.label())}
							>
								<Icon size={28} class="text-surface-700-300" />
								{#if $sidebarExpanded}
									<span>{link.label()}</span>
								{/if}
							</a>
						{/each}
					</Navigation.Menu>
				</Navigation.Group>
			</Navigation.Footer>
		{/if}
	</Navigation>
</div>
