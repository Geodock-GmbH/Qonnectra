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
		onOpenChange={handleOpenChange}
		{onInputValueChange}
	>
		<Combobox.Control>
			<Combobox.Input />
			<Combobox.Trigger />
		</Combobox.Control>
		<Portal>
			<Combobox.Positioner class="z-10">
				<Combobox.Content
					class="z-50 max-h-60 overflow-auto touch-manipulation rounded-md border border-surface-200-800 bg-surface-50-950 shadow-lg"
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
