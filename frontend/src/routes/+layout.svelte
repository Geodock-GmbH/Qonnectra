<script lang="ts">
	import type { LayoutData } from './$types';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { Toast } from '@skeletonlabs/skeleton-svelte';

	import AppBar from '$lib/components/AppBar.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import NavigationProgress from '$lib/components/NavigationProgress.svelte';
	import Sidebar from '$lib/components/SideBar.svelte';
	import { setupNavigationCancellation } from '$lib/map/navigationCancellation.js';
	import { theme } from '$lib/stores/store';
	import { globalToaster } from '$lib/stores/toaster';
	import { stopSessionKeepAlive, syncSessionKeepAlive } from '$lib/utils/sessionKeepAlive';
	import { setRememberedProject } from '$lib/context/rememberedProject.svelte';

	import '../app.css';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	if (browser) {
		setupNavigationCancellation();
	}

	// Fires on hydration and after every navigation, once `data` reflects it.
	afterNavigate(() => syncSessionKeepAlive(data.user?.isAuthenticated ?? false));
	onMount(() => stopSessionKeepAlive);
	onMount(() =>
		theme.subscribe((names) => {
			document.documentElement.setAttribute('data-theme', names.join(' '));
		})
	);

	// svelte-ignore state_referenced_locally
	setRememberedProject(data.rememberedProject);
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

<NavigationProgress />

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
