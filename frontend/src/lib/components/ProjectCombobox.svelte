<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { findProjectLink, navHref } from '$lib/config/navLinks';
	import { getRememberedProject } from '$lib/context/rememberedProject.svelte';

	interface ProjectItem {
		value: string;
		label: string;
	}

	interface Props {
		projects?: ProjectItem[];
		projectsError?: string | null;
		loading?: boolean;
		placeholderSize?: string;
		onChange?: (detail: { value: string }) => void;
	}

	let {
		projects = [],
		projectsError = null,
		loading = false,
		placeholderSize = 'size-10',
		onChange = () => {}
	}: Props = $props();

	let isHydrating = $state(!browser);

	const remembered = getRememberedProject();

	/** The project shown: the URL's on a project page, else the remembered one. */
	const currentProjectId = $derived(page.params.projectId ?? remembered.id ?? '');

	const collection = $derived(
		useListCollection({
			items: projects,
			itemToString: (item) => item?.label ?? '',
			itemToValue: (item) => item?.value ?? ''
		})
	);

	let items = $derived(collection.items);

	onMount(() => {
		isHydrating = false;
		if (projectsError) {
			globalToaster.error({
				title: m.title_error_fetching_projects(),
				description: projectsError
			});
		}
	});

	/** Skeleton Combobox expects string[] */
	let comboboxValue = $derived(currentProjectId ? [currentProjectId] : []);

	function handleOpenChange(e: { open: boolean }) {
		if (e.open) items = projects;
	}

	/**
	 * Switches project. On a project page this is a place: the same page in
	 * the new project, keeping a flag (flags are global) but deliberately
	 * dropping child identifiers (`[uuid]`, `node/[nodeId]`, `?feature=`,
	 * `?page=`) since they belong to the old project. On a global page nothing
	 * navigates: the remembered project changes and every consumer on the page
	 * follows it live.
	 * @param newProject - The chosen project id.
	 */
	function handleProjectChange(newProject: string) {
		if (!browser || newProject === currentProjectId) return;

		const link = findProjectLink(page.route.id);
		if (link) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- navHref() resolves the typed route id
			goto(navHref(link, newProject, { flagId: page.params.flagId }));
		} else {
			remembered.set(newProject);
			selectedProject.set(newProject);
		}

		onChange({ value: newProject });
	}

	function handleValueChange(e: { value: string[] }) {
		const newValue = e.value;
		if (newValue && newValue.length > 0) {
			handleProjectChange(newValue[0]);
		}
	}

	const onInputValueChange = (e: { inputValue: string }) => {
		const filtered = projects.filter((item) =>
			item.label.toLowerCase().includes(e.inputValue.toLowerCase())
		);
		if (filtered.length > 0) {
			items = filtered;
		} else {
			items = projects;
		}
	};
</script>

<!-- Loading/Error States -->
{#if loading || isHydrating}
	<div class="placeholder animate-pulse {placeholderSize}"></div>
{:else if projectsError}
	<div class="alert variant-filled-error text-xs sm:text-sm line-clamp-1">{projectsError}</div>
{:else if projects.length === 0}
	<div class="alert variant-filled-warning text-xs sm:text-sm line-clamp-1">
		{m.message_error_fetching_projects_no_projects()}
	</div>
{:else}
	<Combobox
		class="z-10 w-full min-w-30 max-w-50 sm:max-w-none sm:min-w-45 md:min-w-60"
		placeholder={m.form_project({ count: 1 })}
		{collection}
		defaultValue={comboboxValue}
		value={comboboxValue}
		onValueChange={handleValueChange}
		onOpenChange={handleOpenChange}
		{onInputValueChange}
	>
		<Combobox.Control
			class="flex items-center h-8.75 focus-within:ring-2 focus-within:ring-primary-500/50 focus-within:outline-none transition-shadow rounded"
		>
			<Combobox.Input
				class="placeholder:text-sm placeholder:truncate h-full w-full border-0 bg-transparent focus:ring-0 focus:outline-none focus:bg-transparent"
			/>
			<Combobox.Trigger class="shrink-0" />
		</Combobox.Control>
		<Portal>
			<Combobox.Positioner class="z-50">
				<Combobox.Content
					class="z-50 max-h-[50vh] sm:max-h-60 min-w-50 overflow-auto touch-manipulation rounded-lg border border-surface-200-800 bg-surface-50-950 shadow-xl"
				>
					{#each items as item (item.value)}
						<Combobox.Item
							{item}
							class="cursor-pointer px-4 py-3 sm:px-3 sm:py-2 text-sm rounded-md data-highlighted:not-data-selected:bg-surface-200-800 data-selected:bg-primary-500 data-selected:text-white data-highlighted:data-selected:bg-primary-600 active:scale-[0.98] transition-transform"
						>
							<Combobox.ItemText class="truncate">{item.label}</Combobox.ItemText>
							<Combobox.ItemIndicator />
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Positioner>
		</Portal>
	</Combobox>
{/if}
