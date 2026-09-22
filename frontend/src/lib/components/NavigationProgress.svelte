<script lang="ts" module>
	/**
	 * Feedback for a pending route change: a thin bar along the top edge that
	 * never blocks the page. It is the only owner of route-change feedback;
	 * data for a region of a page waits in a `QueryBoundary` skeleton and a
	 * user action waits on its remote function's `pending`. Same-route URL
	 * changes (query, hash, params) show nothing, so search, pagination,
	 * drawer and tab state can live in the URL without flashing the screen.
	 */

	/** How long a route change must stay pending before the bar shows, in ms. */
	export const NAVIGATION_FEEDBACK_DELAY_MS = 200;
</script>

<script lang="ts">
	import { navigating } from '$app/state';

	import { m } from '$lib/paraglide/messages';

	import { isNetworkSchemaRoute } from '$lib/config/routes';

	const isRouteChange = $derived(
		navigating.to !== null && navigating.from?.route.id !== navigating.to.route.id
	);
	const routeMessage = $derived(
		isNetworkSchemaRoute(navigating.to?.route.id) ? m.message_loading_network_schema() : null
	);
</script>

{#if isRouteChange}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-50"
		style:--navigation-feedback-delay="{NAVIGATION_FEEDBACK_DELAY_MS}ms"
		role="status"
		aria-label={routeMessage ?? m.common_loading()}
		data-testid="navigation-progress"
	>
		<div class="track h-1 overflow-hidden bg-primary-500/20">
			<div class="h-full w-1/3 bg-primary-500"></div>
		</div>
		{#if routeMessage}
			<p
				class="mx-auto mt-2 w-fit rounded-full bg-surface-100-900 px-3 py-1 text-xs text-surface-900-100 shadow"
			>
				{routeMessage}
			</p>
		{/if}
	</div>
{/if}

<style>
	div[role='status'] {
		opacity: 0;
		animation: reveal 150ms ease-out var(--navigation-feedback-delay) forwards;
	}

	.track > div {
		animation: slide 1.2s ease-in-out infinite;
	}

	@keyframes reveal {
		to {
			opacity: 1;
		}
	}

	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}
</style>
