<script>
	import { browser } from '$app/environment';
	import { Toast } from '@skeletonlabs/skeleton-svelte';

	import AppBar from '$lib/components/AppBar.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import Sidebar from '$lib/components/SideBar.svelte';
	import { setupNavigationCancellation } from '$lib/map/navigationCancellation.js';
	import { updateUserStore } from '$lib/stores/auth';
	import { theme } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';

	import '../app.css';

	let { children, data } = $props();

	if (browser) {
		setupNavigationCancellation();
	}

	$effect(() => updateUserStore(data.user));
	$effect(() => {
		document.documentElement.setAttribute('data-theme', $theme.join(' '));
	});
</script>

<div class="flex h-screen">
	<Sidebar />

	<div class="flex flex-1 flex-col overflow-hidden">
		<AppBar {data} />
		<main class="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
			{@render children()}
		</main>
	</div>
</div>

<MobileNav />

<LoadingOverlay />

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
