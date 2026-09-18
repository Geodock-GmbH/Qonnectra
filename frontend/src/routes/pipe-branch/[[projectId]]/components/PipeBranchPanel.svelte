<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import LassoControls from './lasso/LassoControls.svelte';
	import PipeBranchPicker from './PipeBranchPicker.svelte';
	import { getPipeBranchState } from './PipeBranchState.svelte';

	const branch = getPipeBranchState();
</script>

{#snippet pickerSkeleton()}
	<div class="placeholder animate-pulse h-10 w-full rounded" role="status">
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div
	class="card preset-filled-surface-50-950 p-4 space-y-4 flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-auto"
>
	<h1 class="text-lg font-semibold mb-1">{m.common_attributes()}</h1>

	<QueryBoundary pending={pickerSkeleton}>
		<PipeBranchPicker />
	</QueryBoundary>

	{#if branch.nodeUuid}
		<button
			type="button"
			class="btn preset-filled-warning-500 hover:preset-filled-warning-600"
			onclick={() => branch.editSelection()}
		>
			{m.action_edit_trench_selection()}
		</button>
	{/if}

	<LassoControls />
</div>
