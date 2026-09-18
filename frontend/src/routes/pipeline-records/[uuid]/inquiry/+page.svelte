<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { IconArrowLeft } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import QueryBoundary from '$lib/components/QueryBoundary.svelte';

	import InquiryWorkspace from './components/InquiryWorkspace.svelte';

	const uuid = $derived(page.params.uuid ?? '');
</script>

<svelte:head>
	<title>{m.nav_pipeline_inquiry()}</title>
</svelte:head>

{#snippet mapSkeleton()}
	<div
		class="flex-1 rounded-lg border-2 border-surface-200-800 placeholder animate-pulse"
		role="status"
	>
		<span class="sr-only">{m.common_loading()}</span>
	</div>
{/snippet}

<div class="flex flex-col h-full overflow-hidden gap-3">
	<div class="flex items-center">
		<button
			type="button"
			class="btn preset-tonal-surface inline-flex items-center gap-2"
			onclick={() => goto(resolve('/pipeline-records/[uuid]', { uuid }))}
		>
			<IconArrowLeft class="size-4 shrink-0" />
			<span>{m.common_back()}</span>
		</button>
	</div>

	{#key uuid}
		<QueryBoundary pending={mapSkeleton}>
			<InquiryWorkspace recordUuid={uuid} />
		</QueryBoundary>
	{/key}
</div>
