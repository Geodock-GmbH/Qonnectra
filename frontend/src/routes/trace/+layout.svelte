<script>
	import { page } from '$app/state';
	import { IconArrowLeft, IconNetwork } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	import TraceMap from './components/TraceMap.svelte';
	import { createTraceMapContext } from './traceMapContext.svelte.js';

	let { children } = $props();

	const traceMapContext = createTraceMapContext();

	const isLandingPage = $derived(page.url.pathname === '/trace');
	const isFiberRoute = $derived(page.url.pathname.startsWith('/trace/fiber/'));
	const showMap = $derived(
		!isLandingPage && isFiberRoute && traceMapContext.includeGeometry && traceMapContext.traceResult
	);
</script>

<svelte:head>
	<title>{m.nav_fiber_trace()}</title>
</svelte:head>

<div class="min-h-screen">
	{#if isLandingPage}
		<!-- Landing page: Original centered layout -->
		<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
			<header class="mb-8 text-center">
				<div class="mb-4 inline-flex text-primary-500">
					<IconNetwork size={48} stroke={1.5} />
				</div>
				<h1 class="text-3xl font-bold text-surface-900-100">{m.nav_fiber_trace()}</h1>
				<p class="mt-2 text-surface-600-400">{m.trace_description()}</p>
			</header>
			{@render children()}
		</div>
	{:else if showMap}
		<!-- Result page with map: Split view -->
		<div class="flex h-screen flex-col lg:flex-row">
			<!-- Trace results panel -->
			<div class="order-2 flex-1 overflow-y-auto lg:order-1 lg:w-1/2">
				<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
					<header class="mb-6 flex items-center gap-4">
						<a
							href="/trace"
							class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-600-400 transition-colors hover:bg-surface-100-900 hover:text-surface-900-100"
						>
							<IconArrowLeft size={18} />
							<span>{m.action_back()}</span>
						</a>
						<h1 class="text-xl font-bold text-surface-900-100">{m.nav_fiber_trace()}</h1>
					</header>
					{@render children()}
				</div>
			</div>

			<!-- Map panel -->
			<div class="order-1 h-[40vh] shrink-0 lg:order-2 lg:h-auto lg:w-1/2">
				<TraceMap
					traceResult={traceMapContext.traceResult}
					selectedFeatureId={traceMapContext.selectedFeatureId}
					onFeatureSelect={traceMapContext.setSelectedFeature}
				/>
			</div>
		</div>
	{:else}
		<!-- Result page without map -->
		<div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
			<header class="mb-6 flex items-center gap-4">
				<a
					href="/trace"
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-600-400 transition-colors hover:bg-surface-100-900 hover:text-surface-900-100"
				>
					<IconArrowLeft size={18} />
					<span>{m.action_back()}</span>
				</a>
				<h1 class="text-xl font-bold text-surface-900-100">{m.nav_fiber_trace()}</h1>
			</header>
			{@render children()}
		</div>
	{/if}
</div>
