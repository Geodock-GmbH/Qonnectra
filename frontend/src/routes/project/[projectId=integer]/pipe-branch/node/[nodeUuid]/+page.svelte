<script lang="ts">
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';
	import { routeProjectId } from '$lib/context/project';

	import PipeBranchView from '../../components/PipeBranchView.svelte';

	const projectId = $derived(routeProjectId());
	// The node is the identity of what the canvas shows, so it is a path segment.
	const nodeUuid = $derived(page.params.nodeUuid as string);
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
	<!-- Another project or node starts from its own canvas. -->
	{#key projectId}
		<QueryBoundary pending={canvasSkeleton}>
			<PipeBranchView {projectId} {nodeUuid} />
		</QueryBoundary>
	{/key}
</div>
