<script>
	import { navigating } from '$app/stores';
	import { Progress } from '@skeletonlabs/skeleton-svelte';

	import { m } from '$lib/paraglide/messages';

	const skipOverlayRoutes = ['/dashboard', '/map', '/trench', '/pipe-branch', '/house-connections'];

	let isNavigating = $derived($navigating !== null);
	let targetPath = $derived($navigating?.to?.route?.id || '');

	let shouldSkipOverlay = $derived.by(() => {
		if (!targetPath) return false;
		return skipOverlayRoutes.some((route) => targetPath.startsWith(route));
	});

	let isLoading = $derived(isNavigating && !shouldSkipOverlay);

	let loadingMessage = $derived.by(() => {
		if (targetPath.includes('network-schema')) {
			return m.message_loading_network_schema();
		}
		return m.common_loading();
	});
</script>

{#if isLoading}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/50 backdrop-blur-sm"
		role="status"
		aria-live="polite"
		aria-label={loadingMessage}
	>
		<div
			class="card bg-surface-50-950 p-8 rounded-lg shadow-2xl flex flex-col items-center gap-4 min-w-64"
		>
			<!-- Spinner -->
			<Progress class="items-center w-fit" value={null}>
				<Progress.Circle>
					<Progress.CircleTrack />
					<Progress.CircleRange />
				</Progress.Circle>
				<Progress.ValueText />
			</Progress>

			<!-- Loading message -->
			<div class="text-center">
				<h3 class="text-lg font-semibold mb-1">{loadingMessage}</h3>
				<p class="text-sm text-surface-950-50">{m.message_please_wait()}</p>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Smooth fade in/out animation */
	div[role='status'] {
		animation: fadeIn 0.2s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
