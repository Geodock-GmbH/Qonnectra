<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { IconArrowLeft, IconNetwork } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import TraceMapPanel from './components/TraceMapPanel.svelte';
	import { setTraceSelection, TraceSelection } from './components/TraceSelection.svelte';
	import { traceRequestFromPage } from './components/traceOptions';

	let { children }: { children: Snippet } = $props();

	setTraceSelection(new TraceSelection());

	const request = $derived(traceRequestFromPage(page.params, page.url));
	const mapRequest = $derived(
		request?.entryType === 'fiber' && request.options.includeGeometry ? request : null
	);
</script>

{#snippet resultHeader()}
	<header class="mb-4 flex items-center gap-3 sm:mb-6 sm:gap-4">
		<a
			href={resolve('/trace')}
			class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-surface-600-400 transition-colors hover:bg-surface-100-900 hover:text-surface-900-100 sm:gap-2 sm:px-3"
		>
			<IconArrowLeft size={18} />
			<span class="hidden sm:inline">{m.action_back()}</span>
		</a>
		<h1 class="text-lg font-bold text-surface-900-100 sm:text-xl">{m.nav_fiber_trace()}</h1>
	</header>
{/snippet}

<svelte:head>
	<title>{m.nav_fiber_trace()}</title>
</svelte:head>

<div class="min-h-screen">
	{#if !request}
		<div class="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
			<header class="mb-6 text-center sm:mb-8">
				<div class="mb-3 inline-flex text-primary-500 sm:mb-4">
					<IconNetwork size={36} stroke={1.5} class="sm:hidden" />
					<IconNetwork size={48} stroke={1.5} class="hidden sm:block" />
				</div>
				<h1 class="text-2xl font-bold text-surface-900-100 sm:text-3xl">{m.nav_fiber_trace()}</h1>
				<p class="mt-1.5 text-sm text-surface-600-400 sm:mt-2 sm:text-base">
					{m.trace_description()}
				</p>
			</header>
			{@render children()}
		</div>
	{:else if mapRequest}
		<div class="flex h-[calc(100vh-4rem)] flex-col md:h-screen xl:flex-row">
			<div class="order-2 min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0 xl:order-1 xl:w-1/2">
				<div class="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
					{@render resultHeader()}
					{@render children()}
				</div>
			</div>

			<div class="order-1 h-[35vh] min-w-0 shrink-0 sm:h-[40vh] xl:order-2 xl:h-auto xl:w-1/2">
				{#key page.url.href}
					<svelte:boundary>
						<TraceMapPanel request={mapRequest} />

						{#snippet pending()}
							<div class="h-full animate-pulse rounded-xl bg-surface-200-800" role="status">
								<span class="sr-only">{m.common_loading()}</span>
							</div>
						{/snippet}

						<!-- The result panel beside the map reports the failed trace. -->
						{#snippet failed()}
							<div class="h-full rounded-xl border border-surface-200-800 bg-surface-100-900"></div>
						{/snippet}
					</svelte:boundary>
				{/key}
			</div>
		</div>
	{:else}
		<div class="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
			{@render resultHeader()}
			{@render children()}
		</div>
	{/if}
</div>
