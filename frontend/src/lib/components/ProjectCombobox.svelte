<script>
	// Skeleton
	import { Combobox, ProgressRing, Toaster, createToaster } from '@skeletonlabs/skeleton-svelte';

	// Svelte
	import { onMount } from 'svelte';
	import { PUBLIC_MAP_TILES_URL } from '$env/static/public';
	import { selectedProject } from '$lib/stores/store';

	// Paraglide
	import { m } from '$lib/paraglide/messages';

	// Toaster
	const toaster = createToaster({
		placement: 'bottom-end'
	});

	let projects = $state([]);
	let loading = $state(true);
	let error = $state(null);

	onMount(async () => {
		try {
			const response = await fetch(`${PUBLIC_MAP_TILES_URL}projects/`, {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				const projectData = data.results || data;
				projects = projectData.map((p) => ({ label: p.project, value: p.id.toString() }));
			} else {
				toaster.create({
					type: 'error',
					message: 'Error fetching projects',
					description: `Failed to fetch projects: ${response.statusText}`
				});
				error = `Failed to fetch projects: ${response.statusText}`;
			}
		} catch (e) {
			error = `Error fetching projects: ${e.message}`;
			toaster.create({
				type: 'error',
				message: 'Error fetching projects',
				description: error.message || 'Could not fetch projects.'
			});
		} finally {
			loading = false;
		}
	});
</script>

<Toaster {toaster}></Toaster>

{#if loading}
	<ProgressRing
		value={null}
		size="size-10"
		meterStroke="stroke-tertiary-600-400"
		trackStroke="stroke-tertiary-50-950"
	/>
{:else if error}
	<div class="alert variant-filled-error">{error}</div>
{:else}
	<Combobox
		data={projects}
		bind:value={$selectedProject}
		defaultValue={$selectedProject}
		onValueChange={(e) => {
			$selectedProject = e.value;
		}}
		placeholder={m.project()}
		classes="z-10"
	/>
{/if}
