<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import {
		IconBook,
		IconChevronDown,
		IconChevronRight,
		IconDotsVertical,
		IconLanguage
	} from '@tabler/icons-svelte';
	import { env } from '$env/dynamic/public';

	import { m } from '$lib/paraglide/messages';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';

	import { SidebarNavState } from '$lib/classes/SidebarNavState.svelte';
	import { tooltip } from '$lib/utils/tooltip';
	import { isActive, navHref } from '$lib/config/navLinks';
	import { getRememberedProject } from '$lib/context/rememberedProject.svelte';

	import SidebarCustomizeControls from './SidebarCustomizeControls.svelte';
	import SideBarLink from './SideBarLink.svelte';

	const nav = new SidebarNavState();

	let currentLocale = $derived(getLocale());

	const remembered = getRememberedProject();

	/** The project links point at: the URL's project, or the remembered one on a global page. */
	const projectId = $derived(page.params.projectId ?? remembered.id);

	/**
	 * @param locale - Target locale code
	 */
	function switchLocale(locale: 'de' | 'en') {
		setLocale(locale);
	}

	let showMoreMenu = $state(false);

	/** Closes the "More" sheet, e.g. once one of its links is followed. */
	function closeMoreMenu() {
		showMoreMenu = false;
	}

	/** Opens or closes the "More" sheet from the bottom bar. */
	function toggleMoreMenu() {
		showMoreMenu = !showMoreMenu;
	}

	/**
	 * Groups flagged `pinnedToBar` supply the bottom bar and always show every
	 * permitted route; the rest live in the "More" menu and follow the sidebar
	 * customization (hidden routes, collapsed groups).
	 */
	const barLinks = $derived(
		nav.permittedGroups.filter((group) => group.pinnedToBar).flatMap((group) => group.links)
	);
	const moreGroups = $derived(nav.permittedGroups.filter((group) => !group.pinnedToBar));

	const hasMoreContent = $derived(moreGroups.length > 0 || nav.permittedFooterLinks.length > 0);

	let totalTiles = $derived(barLinks.length + (hasMoreContent ? 1 : 0));

	/**
	 * @param isSelected - Whether the nav item is currently active
	 * @returns CSS class string for the anchor element
	 */
	function getAnchorClass(isSelected: boolean): string {
		const baseClass = 'btn hover:preset-tonal flex-col items-center gap-1';
		return isSelected ? `${baseClass} preset-filled` : baseClass;
	}

	/**
	 * @param isSelected - Whether the link points at the current page
	 * @returns CSS class string for a link in the "More" menu
	 */
	function getMenuLinkClass(isSelected: boolean): string {
		const baseClass =
			'flex flex-1 items-center gap-3 p-2 rounded-lg text-surface-900-100 hover:bg-surface-100-800 transition-colors';
		return isSelected ? `${baseClass} preset-tonal` : baseClass;
	}
</script>

<div
	class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-50-900 border-t-2 border-surface-200-800"
>
	<Navigation layout="bar">
		<Navigation.Menu class="grid gap-2" style="grid-template-columns: repeat({totalTiles}, 1fr);">
			{#each barLinks as link (link.id)}
				{@const Icon = link.icon}
				{@const isSelected = isActive(link, page.route.id)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- href comes from navHref(), which resolves the typed route id -->
				<a
					href={navHref(link, projectId)}
					class={getAnchorClass(isSelected)}
					aria-label={link.label()}
					{@attach tooltip(link.label())}
				>
					<Icon size={24} class="text-surface-700-300" />
					<span class="text-[10px]">{link.label()}</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
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

{#if showMoreMenu}
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

	<div
		class="fixed bottom-20 left-4 right-4 z-50 bg-surface-200-800 rounded-t-lg border-2 border-surface-200-800 shadow-lg md:hidden max-h-[70vh] overflow-y-auto overscroll-contain"
		in:slide={{ duration: 200, easing: quintOut }}
	>
		<div class="p-4 space-y-4">
			<div class="flex items-center gap-2">
				<h3 class="text-lg font-semibold text-surface-900-100 flex-1">{m.form_more_sites()}</h3>
				<SidebarCustomizeControls {nav} />
			</div>

			{#each moreGroups as group (group.id)}
				{@const collapsed = nav.isCollapsed(group.id)}
				{@const visibleLinks = nav.visibleLinks(group)}
				{#if visibleLinks.length > 0}
					<section>
						<button
							type="button"
							class="flex w-full items-center justify-between py-1 mb-1 rounded text-xs font-semibold uppercase tracking-wide text-surface-700-300 hover:preset-tonal"
							aria-expanded={!collapsed}
							onclick={() => nav.toggleGroup(group.id)}
						>
							{group.label()}
							{#if collapsed}
								<IconChevronRight class="size-4" />
							{:else}
								<IconChevronDown class="size-4" />
							{/if}
						</button>
						{#if !collapsed}
							<div class="space-y-1">
								{#each visibleLinks as link (link.id)}
									<SideBarLink
										{link}
										{projectId}
										anchorClass={getMenuLinkClass}
										iconClass="size-5"
										customizing={nav.customizing}
										hidden={nav.isHidden(link.id)}
										onToggleHidden={(routeId) => nav.toggleRoute(routeId)}
										onclick={closeMoreMenu}
									/>
								{/each}
							</div>
						{/if}
					</section>
				{/if}
			{/each}

			{#if nav.permittedFooterLinks.length > 0 || env.PUBLIC_DOCUMENTATION_URL}
				<section>
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-700-300 mb-2">
						{m.nav_category_system()}
					</h4>
					<div class="space-y-1">
						{#if env.PUBLIC_DOCUMENTATION_URL}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- external documentation URL -->
							<a
								href={env.PUBLIC_DOCUMENTATION_URL}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100-800 transition-colors"
								onclick={closeMoreMenu}
							>
								<IconBook size={20} class="text-surface-700-300" />
								<span class="text-surface-900-100">{m.nav_documentation()}</span>
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
						{#each nav.permittedFooterLinks as link (link.id)}
							{@const Icon = link.icon}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href comes from navHref(), which resolves the typed route id -->
							<a
								href={navHref(link, projectId)}
								class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-100-800 transition-colors"
								onclick={closeMoreMenu}
							>
								<Icon size={20} class="text-surface-700-300" />
								<span class="text-surface-900-100">{link.label()}</span>
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/each}
					</div>
				</section>
			{/if}

			<section>
				<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-700-300 mb-2">
					{m.common_language()}
				</h4>
				<div class="flex gap-2">
					<button
						class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors {currentLocale ===
						'de'
							? 'bg-primary-500 text-white'
							: 'hover:bg-surface-100-800 text-surface-900-100'}"
						onclick={() => switchLocale('de')}
					>
						<IconLanguage size={20} />
						<span>DE</span>
					</button>
					<button
						class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors {currentLocale ===
						'en'
							? 'bg-primary-500 text-white'
							: 'hover:bg-surface-100-800 text-surface-900-100'}"
						onclick={() => switchLocale('en')}
					>
						<IconLanguage size={20} />
						<span>EN</span>
					</button>
				</div>
			</section>
		</div>
	</div>
{/if}
