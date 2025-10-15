<script>
	// Skeleton
	import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Svelte
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
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

	// Create collection from projects
	const collection = $derived(
		useListCollection({
			items: projects,
			itemToString: (item) => item?.label ?? '',
			itemToValue: (item) => item?.value ?? ''
		})
	);

	// Get items from collection for rendering
	const items = $derived(collection.items);

	$effect(() => {
		if (projectsError && browser) {
			globalToaster.error({
				title: m.title_error_fetching_projects(),
				description: projectsError
			});
		}
	});

	$effect(() => {
		if (browser) {
			isHydrating = false;
		}
	});

	// Handle project change with cookie and navigation
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
</script>

{#if loading || isHydrating}
	<div class="placeholder animate-pulse {placeholderSize}"></div>
{:else if projectsError}
	<div class="alert variant-filled-error text-sm sm:text-base">{projectsError}</div>
{:else if projects.length === 0}
	<div class="alert variant-filled-warning text-sm sm:text-base">
		{m.message_error_fetching_projects_no_projects()}
	</div>
{:else}
	<Combobox
		class="z-10 w-full min-w-0 sm:min-w-48 md:min-w-64"
		placeholder={m.form_project({ count: 1 })}
		{collection}
		defaultValue={$selectedProject}
		onValueChange={handleValueChange}
	>
		<Combobox.Control>
			<Combobox.Input />
			<Combobox.Trigger />
		</Combobox.Control>
		<Portal>
			<Combobox.Positioner class="z-10">
				<Combobox.Content
					class="max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
				>
					{#each items as item (item.value)}
						<Combobox.Item {item}>
							<Combobox.ItemText>{item.label}</Combobox.ItemText>
							<Combobox.ItemIndicator />
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Positioner>
		</Portal>
	</Combobox>
{/if}
