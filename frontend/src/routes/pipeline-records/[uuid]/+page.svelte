<script lang="ts">
	import { page } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import PipelineRecordEditor from './components/PipelineRecordEditor.svelte';

	const uuid = $derived(page.params.uuid ?? '');
</script>

<svelte:head>
	<title>{m.nav_pipeline_records()}</title>
</svelte:head>

<div class="h-full overflow-y-auto p-4 sm:p-6">
	<div class="mx-auto max-w-3xl space-y-6">
		{#key uuid}
			<QueryBoundary>
				<PipelineRecordEditor {uuid} />
			</QueryBoundary>
		{/key}
	</div>
</div>
