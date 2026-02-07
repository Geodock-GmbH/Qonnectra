<script>
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		IconAddressBook,
		IconAffiliate,
		IconArrowBarToRight,
		IconDashboard,
		IconFileText,
		IconHome2,
		IconMap2,
		IconSettings,
		IconTextPlus,
		IconTopologyRing2
	} from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import { userStore } from '$lib/stores/auth';
	import { sidebarExpanded } from '$lib/stores/store';

	import AppIcon from './AppIcon.svelte';

	const mainLinks = [
		{
			href: '/dashboard',
			label: () => m.nav_dashboard(),
			icon: IconDashboard,
			pathMatch: (path) => path.startsWith('/dashboard')
		},
		{
			href: '/map',
			label: () => m.nav_map(),
			icon: IconMap2,
			pathMatch: (path) => path.startsWith('/map')
		}
	];

	const infrastructureLinks = [
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
		}
	];

	const addressLinks = [
		{
			href: '/address',
			label: () => m.nav_address(),
			icon: IconAddressBook,
			pathMatch: (path) => path.startsWith('/address')
		}
	];

	const footerLinks = $derived([
		...($userStore.isAdmin
			? [
					{
						href: '/admin/logs',
						label: () => m.nav_logs(),
						icon: IconFileText,
						pathMatch: (path) => path === '/admin/logs'
					}
				]
			: []),
		{
			href: '/settings',
			label: () => m.nav_settings(),
			icon: IconSettings,
			pathMatch: (path) => path.startsWith('/settings')
		}
	]);

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
			<!-- Main Navigation -->
			<Navigation.Group>
				{#if $sidebarExpanded}
					<Navigation.Label class="text-surface-900-100">{m.nav_category_main()}</Navigation.Label>
				{/if}
				<Navigation.Menu>
					{#each mainLinks as link}
						{@const Icon = link.icon}
						{@const isSelected = link.pathMatch(page.url.pathname)}
						<a
							href={link.href}
							class={getAnchorClass(isSelected)}
							title={link.label()}
							aria-label={link.label()}
						>
							<Icon size={28} class="text-surface-700-300" />
							{#if $sidebarExpanded}
								<span>{link.label()}</span>
							{/if}
						</a>
					{/each}
				</Navigation.Menu>
			</Navigation.Group>

			<!-- Infrastructure -->
			<Navigation.Group>
				{#if $sidebarExpanded}
					<Navigation.Label class="text-surface-900-100"
						>{m.nav_category_infrastructure()}</Navigation.Label
					>
				{/if}
				<Navigation.Menu>
					{#each infrastructureLinks as link}
						{@const Icon = link.icon}
						{@const isSelected = link.pathMatch(page.url.pathname)}
						<a
							href={link.href}
							class={getAnchorClass(isSelected)}
							title={link.label()}
							aria-label={link.label()}
						>
							<Icon size={28} class="text-surface-700-300" />
							{#if $sidebarExpanded}
								<span>{link.label()}</span>
							{/if}
						</a>
					{/each}
				</Navigation.Menu>
			</Navigation.Group>

			<!-- Address -->
			<Navigation.Group>
				{#if $sidebarExpanded}
					<Navigation.Label>{m.nav_address()}</Navigation.Label>
				{/if}
				<Navigation.Menu>
					{#each addressLinks as link}
						{@const Icon = link.icon}
						{@const isSelected = link.pathMatch(page.url.pathname)}
						<a
							href={link.href}
							class={getAnchorClass(isSelected)}
							title={link.label()}
							aria-label={link.label()}
						>
							<Icon size={28} class="text-surface-700-300" />
							{#if $sidebarExpanded}
								<span>{link.label()}</span>
							{/if}
						</a>
					{/each}
				</Navigation.Menu>
			</Navigation.Group>
		</Navigation.Content>
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
							title={link.label()}
							aria-label={link.label()}
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
	</Navigation>
</div>
