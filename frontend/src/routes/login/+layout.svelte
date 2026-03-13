<script>
	import { browser } from '$app/environment';
	import { Toast } from '@skeletonlabs/skeleton-svelte';

	import { setupNavigationCancellation } from '$lib/map/navigationCancellation.js';
	import { updateUserStore } from '$lib/stores/auth';
	import { theme } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import '../../app.css';

	let { children, data } = $props();

	if (browser) {
		setupNavigationCancellation();
	}

	$effect(() => updateUserStore(data.user));
	$effect(() => {
		document.documentElement.setAttribute('data-theme', /** @type {string} */ (/** @type {unknown} */ ($theme)));
	});
</script>

<div class="fixed inset-0 overflow-hidden">
	{@render children()}
</div>

<Toast.Group toaster={globalToaster}>
	{#snippet children(toast)}
		<Toast {toast}>
			<Toast.Message>
				<Toast.Title>{toast.title}</Toast.Title>
				<Toast.Description>{toast.description}</Toast.Description>
			</Toast.Message>
			<Toast.CloseTrigger />
		</Toast>
	{/snippet}
</Toast.Group>
