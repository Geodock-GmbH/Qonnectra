<script>
	import { page } from '$app/state';
	import { IconArrowLeft, IconNetwork } from '@tabler/icons-svelte';

	import { m } from '$lib/paraglide/messages';

	let { children } = $props();

	const isLandingPage = $derived(page.url.pathname === '/trace');
</script>

<svelte:head>
	<title>{m.nav_fiber_trace()}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Header -->
	<header class="mb-8 text-center">
		{#if !isLandingPage}
			<div class="mb-4 flex justify-start">
				<a
					href="/trace"
					class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-600-400 transition-colors hover:bg-surface-100-900 hover:text-surface-900-100"
				>
					<IconArrowLeft size={18} />
					<span>{m.action_back()}</span>
				</a>
			</div>
		{/if}
		<div class="mb-4 inline-flex text-primary-500">
			<IconNetwork size={48} stroke={1.5} />
		</div>
		<h1 class="text-3xl font-bold text-surface-900-100">{m.nav_fiber_trace()}</h1>
		<p class="mt-2 text-surface-600-400">{m.trace_description()}</p>
	</header>

	{@render children()}
</div>
