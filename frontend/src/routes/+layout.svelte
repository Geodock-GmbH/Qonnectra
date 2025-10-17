<script>
	import AppBar from '$lib/components/AppBar.svelte';
	import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import Sidebar from '$lib/components/SideBar.svelte';
	import { updateUserStore } from '$lib/stores/auth';
	import { theme } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { Toast } from '@skeletonlabs/skeleton-svelte';
	import '../app.css';

	let { children, data } = $props();

	$effect(() => updateUserStore(data.user));
	$effect(() => {
		document.documentElement.setAttribute('data-theme', $theme);
	});
</script>

<!-- Root flex container -->
<div class="flex h-screen">
	<!-- Sidebar: Sticky, full height (desktop only) -->
	<Sidebar class="sticky top-0 h-screen flex-shrink-0" />

	<!-- Content Area: Takes remaining space, allows internal scrolling -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- AppBar: Sticky within this container -->
		<AppBar class="sticky top-0 z-10 flex-shrink-0" {data} />
		<!-- Main Content: Scrolls vertically, takes remaining height -->
		<!-- Add bottom padding on mobile to account for navigation bar -->
		<main class="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
			{@render children()}
		</main>
	</div>
</div>

<!-- Mobile Navigation Bar  -->
<MobileNav />

<!-- Global Loading Overlay -->
<LoadingOverlay />

<!-- Global Toaster -->
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
