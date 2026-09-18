<script lang="ts">
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { selectedProject } from '$lib/stores/store';

	import PipeBranchCanvas from './components/PipeBranchCanvas.svelte';

	const projectId = $derived(page.params.projectId ?? $selectedProject ?? '');
</script>

<svelte:head>
	<title>{m.nav_pipe_branch()}</title>
</svelte:head>

{#snippet canvasSkeleton()}
	<div class="h-full w-full rounded-lg placeholder animate-pulse" role="status">
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="border-2 rounded-lg border-surface-200-800 h-full w-full">
	<!-- Another project starts from an empty canvas. -->
	{#key projectId}
		<QueryBoundary pending={canvasSkeleton}>
			<PipeBranchCanvas {projectId} />
		</QueryBoundary>
	{/key}
</div>
