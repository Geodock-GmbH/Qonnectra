<script>
	// Skeleton
	import { Combobox, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { browser } from '$app/environment';
	import { selectedProject } from '$lib/stores/store';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Props - receive projects and error from parent/layout
	let {
		projects = [],
		projectsError = null,
		loading = false,
		placeholderSize = 'size-10',
		onChange = () => {}
	} = $props();

	// Client-side hydration loading state
	let isHydrating = $state(!browser);

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	$effect(() => {
		if (projectsError && browser) {
			toaster.create({
				type: 'error',
				message: m.error_fetching_projects(),
				description: projectsError
			});
		}
	});

	// Update hydration state
	$effect(() => {
		if (browser) {
			isHydrating = false;
		}
	});
</script>

<Toaster {toaster}></Toaster>

{#if loading || isHydrating}
	<div class="placeholder animate-pulse {placeholderSize}"></div>
{:else if projectsError}
	<div class="alert variant-filled-error">{projectsError}</div>
{:else if projects.length === 0}
	<div class="alert variant-filled-warning">
		{m.error_fetching_projects_no_projects()}
	</div>
{:else}
	<Combobox
		data={projects}
		bind:value={$selectedProject}
		defaultValue={$selectedProject}
		onValueChange={(e) => {
			$selectedProject = e.value;
			onChange(e);
		}}
		placeholder={m.project()}
		classes="z-10"
		contentBase="max-h-60 overflow-auto"
	/>
{/if}
