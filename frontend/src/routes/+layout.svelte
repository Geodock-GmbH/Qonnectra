<script>
	import '../app.css';
	import AppBar from '$lib/components/AppBar.svelte';
	import Sidebar from '$lib/components/SideBar.svelte';
	import { setAuthContext } from '$lib/auth.Context';

	let { children, data } = $props();

	setAuthContext(data.user || { isAuthenticated: false });
</script>

<!-- Root flex container -->
<div class="flex h-screen">
	<!-- Sidebar: Sticky, full height -->
	<Sidebar class="sticky top-0 h-screen flex-shrink-0" />

	<!-- Content Area: Takes remaining space, allows internal scrolling -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- AppBar: Sticky within this container -->
		<AppBar class="sticky top-0 z-10 flex-shrink-0" />
		<!-- Main Content: Scrolls vertically, takes remaining height -->
		<main class="flex-1 overflow-y-auto p-4">
			{@render children()}
		</main>
	</div>
</div>
