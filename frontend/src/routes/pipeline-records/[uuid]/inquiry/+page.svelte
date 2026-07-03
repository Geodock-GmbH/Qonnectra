<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { IconArrowLeft } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
</script>

<svelte:head>
	<title>{m.nav_pipeline_inquiry()}</title>
</svelte:head>

<div class="h-full overflow-y-auto p-4 sm:p-6">
	<div class="mx-auto max-w-3xl space-y-6">
		<button
			type="button"
			class="btn preset-tonal-surface inline-flex items-center gap-2"
			onclick={() => goto(`/pipeline-records/${$page.params.uuid}`)}
		>
			<IconArrowLeft class="size-4 shrink-0" />
			<span>{m.common_back()}</span>
		</button>

		{#if !data.recordExists}
			<div class="card preset-tonal-error p-4">Pipeline record not found.</div>
		{:else}
			<div class="card p-6">
				<p class="text-surface-500">{m.nav_pipeline_inquiry()}</p>
			</div>
		{/if}
	</div>
</div>
