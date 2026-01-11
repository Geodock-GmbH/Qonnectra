<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	import { selectedProject } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	let {
		projects = [],
		projectsError = null,
		loading = false,
		placeholderSize = 'size-10',
		onChange = () => {}
	} = $props();

	let isHydrating = $state(!browser);

	const collection = $derived(
		useListCollection({
			items: projects,
			itemToString: (item) => item?.label ?? '',
			itemToValue: (item) => item?.value ?? ''
		})
	);

	let items = $derived(collection.items);
	let isOpen = $state(false);

	$effect(() => {
		if (projectsError && browser) {
			globalToaster.error({
				title: m.title_error_fetching_projects(),
				description: projectsError
			});
		}
	});

	$effect(() => {
		if (isOpen) {
			items = projects;
		}
	});

	$effect(() => {
		if (browser) {
			isHydrating = false;
		}
	});

	// Sync store from URL parameter (source of truth after server-side redirects)
	$effect(() => {
		const urlProjectId = $page.params.projectId;
		if (browser && urlProjectId && urlProjectId !== $selectedProject?.[0]) {
			$selectedProject = [urlProjectId];
		}
	});

	function handleOpenChange(e) {
		isOpen = e.open;
	}

	function handleProjectChange(newProject) {
		if (!browser) return;

		document.cookie = `selected-project=${newProject}; path=/; max-age=31536000`;

		$selectedProject = newProject;

		const pathSegments = $page.url.pathname.split('/').filter(Boolean);
		const baseRoute = pathSegments[0] ? `/${pathSegments[0]}` : '/dashboard';

		goto(`${baseRoute}/${newProject}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true,
			invalidateAll: true
		});

		onChange({ value: newProject });
	}

	function handleValueChange(e) {
		const newValue = e.value;
		if (newValue) {
			handleProjectChange(newValue);
		}
	}

	const onInputValueChange = (e) => {
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
		class="z-10 w-full min-w-0 max-w-[200px] sm:max-w-none sm:min-w-[180px] md:min-w-[240px]"
		placeholder={m.form_project({ count: 1 })}
		{collection}
		defaultValue={$selectedProject}
		value={$selectedProject}
		onValueChange={handleValueChange}
		onOpenChange={handleOpenChange}
		{onInputValueChange}
	>
		<Combobox.Control
			class="flex items-center h-[35px] focus-within:ring-2 focus-within:ring-primary-500/50 focus-within:outline-none transition-shadow rounded"
		>
			<Combobox.Input
				class="placeholder:text-sm placeholder:truncate h-full w-full border-0 bg-transparent focus:ring-0 focus:outline-none focus:bg-transparent"
			/>
			<Combobox.Trigger class="flex-shrink-0" />
		</Combobox.Control>
		<Portal>
			<Combobox.Positioner class="z-50">
				<Combobox.Content
					class="z-50 max-h-[50vh] sm:max-h-60 min-w-[200px] overflow-auto touch-manipulation rounded-lg border border-surface-200-800 bg-surface-50-950 shadow-xl"
				>
					{#each items as item (item.value)}
						<Combobox.Item
							{item}
							class="cursor-pointer px-4 py-3 sm:px-3 sm:py-2 text-sm rounded-md data-[highlighted]:not-data-[selected]:bg-surface-200-800 data-[selected]:bg-primary-500 data-[selected]:text-white data-[highlighted]:data-[selected]:bg-primary-600 active:scale-[0.98] transition-transform"
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
