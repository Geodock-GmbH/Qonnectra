<script lang="ts">
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import { IconBook, IconChevronDown, IconChevronRight } from '@tabler/icons-svelte';
	import { env } from '$env/dynamic/public';

	import { m } from '$lib/paraglide/messages';

	import { SidebarNavState } from '$lib/classes/SidebarNavState.svelte';
	import { sidebarExpanded } from '$lib/stores/store';
	import { tooltip } from '$lib/utils/tooltip';
	import { isActive, navHref } from '$lib/config/navLinks';
	import { getRememberedProject } from '$lib/context/rememberedProject.svelte';

	import AppIcon from './AppIcon.svelte';
	import SidebarCustomizeControls from './SidebarCustomizeControls.svelte';
	import SideBarLink from './SideBarLink.svelte';

	const nav = new SidebarNavState();

	const remembered = getRememberedProject();

	/** The project links point at: the URL's project, or the remembered one on a global page. */
	const projectId = $derived(page.params.projectId ?? remembered.id);

	/** Flat list of all permitted content links, used for the collapsed rail layout. */
	const railLinks = $derived(nav.permittedGroups.flatMap((group) => group.links));

	/**
	 * @param isSelected - Whether the nav item is currently active
	 * @returns CSS class string for the anchor element
	 */
	function getAnchorClass(isSelected: boolean): string {
		const justifyClass = $sidebarExpanded ? 'justify-start' : 'justify-center';
		const paddingClass = $sidebarExpanded ? 'px-2' : 'px-2 py-3';
		const baseClass = `btn hover:preset-tonal ${justifyClass} ${paddingClass} w-full`;
		return isSelected ? `${baseClass} preset-filled` : baseClass;
	}
</script>

<div class="hidden md:block border-r-2 border-surface-200-800">
	<Navigation
		layout={$sidebarExpanded ? 'sidebar' : 'rail'}
		class="grid grid-rows-[auto_1fr_auto] gap-4"
	>
		<Navigation.Header>
			<div class="flex items-center gap-2 {$sidebarExpanded ? 'p-2' : 'p-4 justify-center'}">
				{#if $sidebarExpanded}
					<AppIcon size="1.75rem" />
					<h1 class="text-2xl font-semibold leading-none flex-1">Qonnectra</h1>
					<SidebarCustomizeControls {nav} />
				{:else}
					<AppIcon />
				{/if}
			</div>
		</Navigation.Header>
		<Navigation.Content>
			{#if $sidebarExpanded}
				<!-- Expanded: grouped navigation with collapsible labels -->
				{#each nav.permittedGroups as group (group.id)}
					{@const collapsed = nav.isCollapsed(group.id)}
					{@const visibleLinks = nav.visibleLinks(group)}
					{#if visibleLinks.length > 0}
						<Navigation.Group>
							<button
								type="button"
								class="flex w-full items-center justify-between px-2 py-1 text-surface-900-100 hover:preset-tonal rounded"
								aria-expanded={!collapsed}
								onclick={() => nav.toggleGroup(group.id)}
							>
								<Navigation.Label class="text-surface-900-100">{group.label()}</Navigation.Label>
								{#if collapsed}
									<IconChevronRight class="size-4 text-surface-700-300" />
								{:else}
									<IconChevronDown class="size-4 text-surface-700-300" />
								{/if}
							</button>
							{#if !collapsed}
								<Navigation.Menu>
									{#each visibleLinks as link (link.id)}
										<SideBarLink
											{link}
											{projectId}
											anchorClass={getAnchorClass}
											customizing={nav.customizing}
											hidden={nav.isHidden(link.id)}
											onToggleHidden={(routeId) => nav.toggleRoute(routeId)}
										/>
									{/each}
								</Navigation.Menu>
							{/if}
						</Navigation.Group>
					{/if}
				{/each}
			{:else}
				<!-- Collapsed: single flat list of icons -->
				<Navigation.Group>
					<Navigation.Menu>
						{#each railLinks as link (link.id)}
							{#if !nav.isHidden(link.id)}
								<SideBarLink {link} {projectId} anchorClass={getAnchorClass} iconOnly />
							{/if}
						{/each}
					</Navigation.Menu>
				</Navigation.Group>
			{/if}
		</Navigation.Content>
		<!-- Footer Navigation -->
		{#if nav.permittedFooterLinks.length > 0 || env.PUBLIC_DOCUMENTATION_URL}
			<Navigation.Footer>
				<Navigation.Group>
					{#if $sidebarExpanded}
						<Navigation.Label>{m.nav_category_system()}</Navigation.Label>
					{/if}
					<Navigation.Menu>
						{#each nav.permittedFooterLinks as link (link.id)}
							{@const Icon = link.icon}
							{@const isSelected = isActive(link, page.route.id)}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href comes from navHref(), which resolves the typed route id -->
							<a
								href={navHref(link, projectId)}
								class={getAnchorClass(isSelected)}
								aria-label={link.label()}
								{@attach tooltip(link.label())}
							>
								<Icon class="size-7 text-surface-700-300" />
								{#if $sidebarExpanded}
									<span>{link.label()}</span>
								{/if}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/each}
						{#if env.PUBLIC_DOCUMENTATION_URL}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- external documentation URL -->
							<a
								href={env.PUBLIC_DOCUMENTATION_URL}
								target="_blank"
								rel="noopener noreferrer"
								class={getAnchorClass(false)}
								aria-label={m.nav_documentation()}
								{@attach tooltip(m.nav_documentation())}
							>
								<IconBook class="size-7 text-surface-700-300" />
								{#if $sidebarExpanded}
									<span>{m.nav_documentation()}</span>
								{/if}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
					</Navigation.Menu>
				</Navigation.Group>
			</Navigation.Footer>
		{/if}
	</Navigation>
</div>
