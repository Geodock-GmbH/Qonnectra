<script lang="ts">
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { Toast } from '@skeletonlabs/skeleton-svelte';

	import { setupNavigationCancellation } from '$lib/map/navigationCancellation.js';
	import { globalToaster } from '$lib/stores/toaster';

	import '../../app.css';

	let { children }: { children: Snippet } = $props();

	if (browser) {
		setupNavigationCancellation();
	}
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
