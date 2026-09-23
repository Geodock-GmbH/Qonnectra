<script lang="ts">
	import { quintOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import { IconBook, IconDotsVertical, IconLanguage } from '@tabler/icons-svelte';
	import { env } from '$env/dynamic/public';

	import { m } from '$lib/paraglide/messages';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';

	import { canAccessRoute } from '$lib/utils/permissions';
	import { tooltip } from '$lib/utils/tooltip';
	import { footerLinks, isActive, navGroups, navHref } from '$lib/config/navLinks';
	import { getRememberedProject } from '$lib/context/rememberedProject.svelte';

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

	function closeMoreMenu() {
		showMoreMenu = false;
	}

	function toggleMoreMenu() {
		showMoreMenu = !showMoreMenu;
	}

	/**
	 * Content groups filtered to the routes the current user may access. The
	 * mobile navigation shows every permitted route regardless of the desktop
	 * sidebar customization.
	 */
	const permittedGroups = $derived(
		navGroups
			.map((group) => ({
				...group,
				links: group.links.filter((link) =>
					canAccessRoute(page.data.user?.permissions, link.permissionKey)
				)
			}))
			.filter((group) => group.links.length > 0)
	);

	const permittedFooterLinks = $derived(
		footerLinks.filter((link) => canAccessRoute(page.data.user?.permissions, link.permissionKey))
	);

	/** Groups flagged `pinnedToBar` supply the bottom bar; the rest live in the "More" menu. */
	const barLinks = $derived(
		permittedGroups.filter((group) => group.pinnedToBar).flatMap((group) => group.links)
	);
	const moreGroups = $derived(permittedGroups.filter((group) => !group.pinnedToBar));

	const hasMoreContent = $derived(moreGroups.length > 0 || permittedFooterLinks.length > 0);

	let totalTiles = $derived(barLinks.length + (hasMoreContent ? 1 : 0));

	/**
	 * @param isSelected - Whether the nav item is currently active
	 * @returns CSS class string for the anchor element
	 */
	function getAnchorClass(isSelected: boolean): string {
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
		class="fixed bottom-20 left-4 right-4 z-50 bg-surface-200-800 rounded-t-lg border-2 border-surface-200-800 shadow-lg md:hidden max-h-[70vh] overflow-y-auto overscroll-contain"
		in:slide={{ duration: 200, easing: quintOut }}
	>
		<div class="p-4 space-y-4">
			<h3 class="text-lg font-semibold text-surface-900-100">{m.form_more_sites()}</h3>

			{#each moreGroups as group (group.id)}
				<section>
					<h4 class="text-xs font-semibold uppercase tracking-wide text-surface-700-300 mb-2">
						{group.label()}
					</h4>
					<div class="space-y-1">
						{#each group.links as link (link.id)}
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
			{/each}

			{#if permittedFooterLinks.length > 0 || env.PUBLIC_DOCUMENTATION_URL}
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
						{#each permittedFooterLinks as link (link.id)}
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
