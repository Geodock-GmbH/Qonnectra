<script>
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		IconAdjustmentsHorizontal,
		IconBook,
		IconChevronDown,
		IconChevronRight,
		IconRestore
	} from '@tabler/icons-svelte';
	import { env } from '$env/dynamic/public';

	import { m } from '$lib/paraglide/messages';

	import { userStore } from '$lib/stores/auth';
	import {
		isGroupCollapsed,
		isRouteHidden,
		sidebarPreferences,
		toggleGroupCollapsed,
		toggleRouteHidden
	} from '$lib/stores/sidebarPreferences';
	import { sidebarExpanded } from '$lib/stores/store';
	import { canAccessRoute } from '$lib/utils/permissions';
	import { tooltip } from '$lib/utils/tooltip';
	import { footerLinks, navGroups } from '$lib/config/navLinks';

	import AppIcon from './AppIcon.svelte';
	import SideBarLink from './SideBarLink.svelte';

	/** Whether the customize controls (per-route hide toggles, reset) are shown. */
	let customizing = $state(false);

	/**
	 * Content groups filtered to the routes the current user may access. Hidden
	 * routes are kept here so they can still be revealed while customizing; the
	 * template drops them from the normal view.
	 */
	const permittedGroups = $derived(
		navGroups
			.map((group) => ({
				...group,
				links: group.links.filter((link) => canAccessRoute($userStore.permissions, link.href))
			}))
			.filter((group) => group.links.length > 0)
	);

	const permittedFooterLinks = $derived(
		footerLinks.filter((link) => canAccessRoute($userStore.permissions, link.href))
	);

	/** Flat list of all permitted content links, used for the collapsed rail layout. */
	const railLinks = $derived(permittedGroups.flatMap((group) => group.links));

	/**
	 * @param {boolean} isSelected - Whether the nav item is currently active
	 * @returns {string} CSS class string for the anchor element
	 */
	function getAnchorClass(isSelected) {
		const justifyClass = $sidebarExpanded ? 'justify-start' : 'justify-center';
		const paddingClass = $sidebarExpanded ? 'px-2' : 'px-2 py-3';
		const baseClass = `btn hover:preset-tonal ${justifyClass} ${paddingClass} w-full`;
		return isSelected ? `${baseClass} preset-filled` : baseClass;
	}

	/** @param {string} groupId - Stable id of the group to expand/collapse */
	function handleToggleGroup(groupId) {
		sidebarPreferences.update((prefs) => toggleGroupCollapsed(prefs, groupId));
	}

	/** @param {string} routeId - Stable id of the route to hide/show */
	function handleToggleRoute(routeId) {
		sidebarPreferences.update((prefs) => toggleRouteHidden(prefs, routeId));
	}

	/** Clears all hidden routes and collapsed groups back to defaults. */
	function resetPreferences() {
		sidebarPreferences.set({ hiddenRoutes: [], collapsedGroups: [] });
	}
</script>

<!-- SideBar -->
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
					{#if customizing}
						<button
							type="button"
							class="btn-icon btn-icon-sm hover:preset-tonal self-center"
							aria-label={m.action_reset_sidebar()}
							{@attach tooltip(m.action_reset_sidebar(), { position: 'bottom' })}
							onclick={resetPreferences}
						>
							<IconRestore class="size-5 text-surface-700-300" />
						</button>
					{/if}
					<button
						type="button"
						class="btn-icon btn-icon-sm hover:preset-tonal self-center {customizing
							? 'preset-filled'
							: ''}"
						aria-pressed={customizing}
						aria-label={customizing ? m.action_done_customizing() : m.action_customize_sidebar()}
						{@attach tooltip(
							customizing ? m.action_done_customizing() : m.action_customize_sidebar(),
							{ position: 'bottom' }
						)}
						onclick={() => (customizing = !customizing)}
					>
						<IconAdjustmentsHorizontal class="size-5 text-surface-700-300" />
					</button>
				{:else}
					<AppIcon />
				{/if}
			</div>
		</Navigation.Header>
		<Navigation.Content>
			{#if $sidebarExpanded}
				<!-- Expanded: grouped navigation with collapsible labels -->
				{#each permittedGroups as group (group.id)}
					{@const collapsed = isGroupCollapsed($sidebarPreferences, group.id)}
					{@const visibleLinks = customizing
						? group.links
						: group.links.filter((link) => !isRouteHidden($sidebarPreferences, link.id))}
					{#if visibleLinks.length > 0}
						<Navigation.Group>
							<button
								type="button"
								class="flex w-full items-center justify-between px-2 py-1 text-surface-900-100 hover:preset-tonal rounded"
								aria-expanded={!collapsed}
								onclick={() => handleToggleGroup(group.id)}
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
											anchorClass={getAnchorClass}
											{customizing}
											hidden={isRouteHidden($sidebarPreferences, link.id)}
											onToggleHidden={handleToggleRoute}
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
							{#if !isRouteHidden($sidebarPreferences, link.id)}
								<SideBarLink {link} anchorClass={getAnchorClass} iconOnly />
							{/if}
						{/each}
					</Navigation.Menu>
				</Navigation.Group>
			{/if}
		</Navigation.Content>
		<!-- Footer Navigation -->
		{#if permittedFooterLinks.length > 0 || env.PUBLIC_DOCUMENTATION_URL}
			<Navigation.Footer>
				<Navigation.Group>
					{#if $sidebarExpanded}
						<Navigation.Label>{m.nav_category_system()}</Navigation.Label>
					{/if}
					<Navigation.Menu>
						{#each permittedFooterLinks as link (link.id)}
							{@const Icon = link.icon}
							{@const isSelected = link.pathMatch(page.url.pathname)}
							<a
								href={link.href}
								class={getAnchorClass(isSelected)}
								aria-label={link.label()}
								{@attach tooltip(link.label())}
							>
								<Icon class="size-7 text-surface-700-300" />
								{#if $sidebarExpanded}
									<span>{link.label()}</span>
								{/if}
							</a>
						{/each}
						{#if env.PUBLIC_DOCUMENTATION_URL}
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
						{/if}
					</Navigation.Menu>
				</Navigation.Group>
			</Navigation.Footer>
		{/if}
	</Navigation>
</div>
